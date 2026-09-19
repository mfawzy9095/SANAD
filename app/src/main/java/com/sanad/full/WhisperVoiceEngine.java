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
import java.util.Locale;
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
    private volatile boolean pendingPrepare = false;
    private volatile String language = "ar";

    public WhisperVoiceEngine(Activity activity, Listener listener) {
        this.activity = activity;
        this.listener = listener;
        // V2.9: do not load Whisper at app startup. Voice is prepared only when the user opens voice mode.
    }

    public boolean isRecording() { return recording.get(); }

    public String status() {
        if (recording.get()) return "recording";
        if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return "permission_required";
        if (modelLoading) return "loading_model";
        return whisperCtx != 0L ? "ready" : "model_not_ready";
    }

    public void prepare() {
        if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingPrepare = true;
            listener.onState("permission_required", language);
            activity.requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 401);
            return;
        }
        pendingPrepare = false;
        if (whisperCtx == 0L) { listener.onState("loading_model", language); warmup(); }
        else listener.onState("ready", language);
    }

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
                    activity.runOnUiThread(() -> start(language));
                } else {
                    listener.onState("ready", language);
                }
            } catch (Throwable t) {
                listener.onError("تعذر تشغيل محرك Whisper داخل سند");
            } finally {
                modelLoading = false;
            }
        });
    }

    public void start(String locale) {
        if (recording.get()) return;
        String l = locale == null ? "ar" : locale.toLowerCase(Locale.ROOT);
        language = l.startsWith("en") ? "en" : "ar";
        if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingPrepare = false;
            pendingStart = true;
            listener.onState("permission_required", language);
            activity.requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 401);
            return;
        }
        if (whisperCtx == 0L) {
            pendingStart = true;
            listener.onState("loading_model", language);
            warmup();
            return;
        }
        int rawMin = AudioRecord.getMinBufferSize(SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        final int min = Math.max(rawMin > 0 ? rawMin : 4096, 4096);
        listener.onState("starting", language);
        try {
            recorder = openRecorder(MediaRecorder.AudioSource.MIC, min);
            if (recorder == null) recorder = openRecorder(MediaRecorder.AudioSource.VOICE_RECOGNITION, min);
            if (recorder == null) throw new IllegalStateException("audio init");
            recorder.startRecording();
            if (recorder.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING)
                throw new IllegalStateException("audio did not start");
            recording.set(true);
            listener.onState("silent", language);
            worker.execute(() -> recordLoop(min));
        } catch (Throwable t) {
            safeRelease();
            recording.set(false);
            listener.onError("تعذر فتح الميكروفون. تأكد من إذن الميكروفون وأن تطبيقًا آخر لا يستخدمه.");
        }
    }

    public void onPermissionGranted() {
        if (pendingStart) {
            pendingStart = false;
            start(language);
            return;
        }
        if (pendingPrepare) {
            pendingPrepare = false;
            prepare();
        }
    }

    public void onPermissionDenied(boolean permanentlyDenied) {
        pendingStart = false;
        pendingPrepare = false;
        listener.onState(permanentlyDenied ? "permission_blocked" : "permission_denied", language);
        listener.onError(permanentlyDenied ? "إذن الميكروفون مقفول. افتح إعدادات التطبيق وفعّل Microphone." : "صلاحية الميكروفون مطلوبة للصوت");
    }

    private void recordLoop(int bufferSize) {
        ByteArrayOutputStream pcm = new ByteArrayOutputStream(SAMPLE_RATE * 2 * 15);
        short[] buf = new short[Math.max(1024, bufferSize / 2)];
        long started = SystemClock.elapsedRealtime();
        boolean lastSpeech = false;
        try {
            while (recording.get()) {
                int n = recorder.read(buf, 0, buf.length);
                if (n < 0) break;
                if (n == 0) continue;
                double sum = 0;
                for (int i = 0; i < n; i++) {
                    short s = buf[i];
                    sum += (double)s * (double)s;
                    pcm.write(s & 0xff);
                    pcm.write((s >> 8) & 0xff);
                }
                double rms = Math.sqrt(sum / Math.max(1, n));
                boolean speech = rms >= 260.0;
                float level = (float)Math.min(12.0, Math.max(0.0, 20.0 * Math.log10((rms + 1.0) / 180.0) + 5.0));
                listener.onLevel(level);
                if (speech != lastSpeech) {
                    lastSpeech = speech;
                    listener.onState(speech ? "speech" : "silent", language);
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
        if (bytes.length < SAMPLE_RATE) {
            listener.onDone("");
            listener.onState("stopped", language);
            return;
        }
        listener.onState("processing", language);
        float[] audio = new float[bytes.length / 2];
        for (int i = 0, j = 0; i + 1 < bytes.length; i += 2, j++) {
            int lo = bytes[i] & 0xff;
            int hi = bytes[i + 1];
            short s = (short)((hi << 8) | lo);
            audio[j] = s / 32768.0f;
        }
        try {
            int threads = Math.max(2, Math.min(6, Runtime.getRuntime().availableProcessors() - 2));
            String text = WhisperLib.transcribe(whisperCtx, threads, audio, language);
            if (text == null) text = "";
            text = text.replaceAll("\\s+", " ").trim();
            listener.onResult(text);
            listener.onDone(text);
        } catch (Throwable t) {
            listener.onError("حصل خطأ أثناء تحويل الصوت إلى نص");
        } finally {
            listener.onState("stopped", language);
        }
    }

    public void stop() {
        if (!recording.getAndSet(false)) {
            pendingStart = false;
            return;
        }
        AudioRecord r = recorder;
        if (r != null) {
            try { r.stop(); } catch (Throwable ignored) {}
        }
    }

    private AudioRecord openRecorder(int source,int min){
        try{
            AudioRecord r=new AudioRecord(source,SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT,min*2);
            if(r.getState()==AudioRecord.STATE_INITIALIZED) return r;
            try{r.release();}catch(Throwable ignored){}
        }catch(Throwable ignored){}
        return null;
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
