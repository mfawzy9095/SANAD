package com.sanad.full;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.SystemClock;

import com.sanad.full.whisper.WhisperLib;

import java.io.ByteArrayOutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public final class WhisperVoiceEngine {
    public interface Listener {
        void onState(String state, String detail);
        void onLevel(float level);
        void onResult(String text);
        void onDone(String text);
        void onError(String message);
    }

    private static final int SAMPLE_RATE = 16000;
    private static final int MAX_SECONDS = 90;
    private final Activity activity;
    private final Listener listener;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean recording = new AtomicBoolean(false);
    private volatile AudioRecord recorder;
    private volatile long whisperCtx = 0L;
    private volatile boolean modelLoading = false;
    private volatile boolean pendingStart = false;

    public WhisperVoiceEngine(Activity activity, Listener listener) {
        this.activity = activity;
        this.listener = listener;
        warmup();
    }

    public boolean isRecording() { return recording.get(); }

    public void warmup() {
        if (whisperCtx != 0L || modelLoading) return;
        modelLoading = true;
        worker.execute(() -> {
            try {
                long ctx = WhisperLib.initContextFromAsset(activity.getAssets(), "models/ggml-base-q5_1.bin");
                if (ctx == 0L) throw new IllegalStateException("model init failed");
                whisperCtx = ctx;
                if (pendingStart) {
                    pendingStart = false;
                    activity.runOnUiThread(this::start);
                }
            } catch (Throwable t) {
                listener.onError("تعذر تشغيل محرك الصوت العربي داخل سند");
            } finally {
                modelLoading = false;
            }
        });
    }

    public void start() {
        if (recording.get()) return;
        if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingStart = true;
            activity.requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 401);
            return;
        }
        if (whisperCtx == 0L) {
            pendingStart = true;
            listener.onState("loading_model", "");
            warmup();
            return;
        }
        final int min = Math.max(AudioRecord.getMinBufferSize(SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT), 4096);
        try {
            recorder = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, min * 2);
            if (recorder.getState() != AudioRecord.STATE_INITIALIZED) throw new IllegalStateException("audio init");
            recorder.startRecording();
            recording.set(true);
            listener.onState("silent", "");
            worker.execute(() -> recordLoop(min));
        } catch (Throwable t) {
            safeRelease();
            recording.set(false);
            listener.onError("تعذر فتح الميكروفون");
        }
    }

    public void onPermissionGranted() {
        if (pendingStart) {
            pendingStart = false;
            start();
        }
    }

    private void recordLoop(int bufferSize) {
        ByteArrayOutputStream pcm = new ByteArrayOutputStream(SAMPLE_RATE * 2 * 15);
        short[] buf = new short[Math.max(1024, bufferSize / 2)];
        long started = SystemClock.elapsedRealtime();
        boolean lastSpeech = false;
        int speechWindows = 0;
        try {
            while (recording.get()) {
                int n = recorder.read(buf, 0, buf.length);
                if (n <= 0) continue;
                double sum = 0;
                for (int i = 0; i < n; i++) {
                    short s = buf[i];
                    sum += (double)s * (double)s;
                    pcm.write(s & 0xff);
                    pcm.write((s >> 8) & 0xff);
                }
                double rms = Math.sqrt(sum / Math.max(1, n));
                boolean speech = rms >= 550.0;
                if (speech) speechWindows++;
                float level = (float)Math.min(12.0, Math.max(0.0, 20.0 * Math.log10((rms + 1.0) / 250.0) + 5.0));
                listener.onLevel(level);
                if (speech != lastSpeech) {
                    lastSpeech = speech;
                    listener.onState(speech ? "speech" : "silent", "");
                }
                if (SystemClock.elapsedRealtime() - started >= MAX_SECONDS * 1000L) {
                    recording.set(false);
                    break;
                }
            }
        } catch (Throwable ignored) {
        } finally {
            safeRelease();
        }

        final byte[] bytes = pcm.toByteArray();
        if (bytes.length < SAMPLE_RATE / 2 || speechWindows < 2) {
            listener.onDone("");
            listener.onState("stopped", "");
            return;
        }
        listener.onState("processing", "");
        float[] audio = new float[bytes.length / 2];
        for (int i = 0, j = 0; i + 1 < bytes.length; i += 2, j++) {
            int lo = bytes[i] & 0xff;
            int hi = bytes[i + 1];
            short s = (short)((hi << 8) | lo);
            audio[j] = s / 32768.0f;
        }
        try {
            int threads = Math.max(2, Math.min(6, Runtime.getRuntime().availableProcessors() - 2));
            String text = WhisperLib.transcribeArabic(whisperCtx, threads, audio);
            if (text == null) text = "";
            text = text.replaceAll("\\s+", " ").trim();
            listener.onResult(text);
            listener.onDone(text);
        } catch (Throwable t) {
            listener.onError("حصل خطأ أثناء تحويل الصوت إلى نص");
        } finally {
            listener.onState("stopped", "");
        }
    }

    public void stop() {
        if (!recording.getAndSet(false)) {
            if (pendingStart) pendingStart = false;
            return;
        }
        AudioRecord r = recorder;
        if (r != null) {
            try { r.stop(); } catch (Throwable ignored) {}
        }
    }

    private void safeRelease() {
        AudioRecord r = recorder;
        recorder = null;
        if (r != null) {
            try { if (r.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) r.stop(); } catch (Throwable ignored) {}
            try { r.release(); } catch (Throwable ignored) {}
        }
    }

    public void release() {
        stop();
        worker.execute(() -> {
            long ctx = whisperCtx;
            whisperCtx = 0L;
            if (ctx != 0L) {
                try { WhisperLib.freeContext(ctx); } catch (Throwable ignored) {}
            }
        });
        worker.shutdown();
    }
}
