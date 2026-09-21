package com.sanad.full;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.AudioRecordingConfiguration;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.SystemClock;

import com.sanad.full.whisper.WhisperLib;

import java.io.ByteArrayOutputStream;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * V3.6 deterministic offline voice recorder.
 *
 * The microphone opens immediately after a tap. Model loading happens in
 * parallel, so recording never waits on Whisper initialization.
 */
public final class WhisperVoiceEngine {
    public interface Listener {
        void onState(String state,String detail);
        void onLevel(float level);
        void onResult(String text);
        void onDone(String text);
        void onError(String message);
    }

    private static final int SAMPLE_RATE=16000;
    private static final int MAX_SECONDS=60;
    private static final long PARTIAL_INTERVAL_MS=2600L;
    private static final long AUTO_STOP_SILENCE_MS=1600L;

    private final Activity activity;
    private final Listener listener;
    private final ExecutorService audioWorker=Executors.newSingleThreadExecutor();
    private final ExecutorService inferenceWorker=Executors.newSingleThreadExecutor();
    private final AtomicBoolean recording=new AtomicBoolean(false);
    private final AtomicBoolean partialBusy=new AtomicBoolean(false);

    private volatile AudioRecord recorder;
    private volatile long whisperCtx=0L;
    private volatile boolean modelLoading=false;
    private volatile boolean modelFailed=false;
    private volatile boolean pendingPermissionStart=false;
    private volatile boolean pendingPrepare=false;
    private volatile String language="ar";

    private volatile int lastAudioSource=0;
    private volatile int lastReadError=0;
    private volatile long lastSamples=0L;
    private volatile double lastRms=0.0;
    private volatile int lastPeak=0;
    private volatile boolean lastClientSilenced=false;

    public WhisperVoiceEngine(Activity activity,Listener listener){
        this.activity=activity;
        this.listener=listener;
    }

    public boolean isRecording(){ return recording.get(); }

    public String diagnostics(){
        return "source="+lastAudioSource+
                ";readError="+lastReadError+
                ";samples="+lastSamples+
                ";rms="+String.format(Locale.US,"%.1f",lastRms)+
                ";peak="+lastPeak+
                ";silenced="+lastClientSilenced+
                ";recording="+recording.get()+
                ";model="+(whisperCtx!=0L?"ready":(modelLoading?"loading":(modelFailed?"failed":"not_loaded")));
    }

    public String status(){
        if(activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED)
            return "permission_required";
        if(recording.get()) return "recording";
        if(modelLoading) return "loading_model";
        if(modelFailed) return "model_error";
        return whisperCtx!=0L?"ready":"model_not_ready";
    }

    public void prepare(){
        if(activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
            pendingPrepare=true;
            listener.onState("permission_required",language);
            activity.requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},401);
            return;
        }
        pendingPrepare=false;
        if(whisperCtx==0L && !modelLoading) warmup();
        listener.onState(whisperCtx!=0L?"ready":"model_loading_background",language);
    }

    public void warmup(){
        if(whisperCtx!=0L || modelLoading) return;
        modelLoading=true;
        modelFailed=false;
        inferenceWorker.execute(()->{
            try{
                long ctx=WhisperLib.initContextFromAsset(activity.getAssets(),"models/ggml-base-q5_1.bin");
                if(ctx==0L) throw new IllegalStateException("model init failed");
                whisperCtx=ctx;
                modelFailed=false;
                listener.onState("model_ready",language);
            }catch(Throwable t){
                modelFailed=true;
                listener.onState("model_error",String.valueOf(t.getClass().getSimpleName()));
                if(!recording.get()) listener.onError("تعذر تحميل نموذج Whisper المحلي");
            }finally{
                modelLoading=false;
            }
        });
    }

    public void start(String locale){
        if(recording.get()) return;

        String l=locale==null?"ar":locale.toLowerCase(Locale.ROOT);
        language=l.startsWith("en")?"en":"ar";

        if(activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
            pendingPrepare=false;
            pendingPermissionStart=true;
            listener.onState("permission_required",language);
            activity.requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},401);
            return;
        }

        pendingPermissionStart=false;

        // Start model initialization in parallel. Do NOT wait for it before opening the mic.
        if(whisperCtx==0L && !modelLoading) warmup();

        int rawMin=AudioRecord.getMinBufferSize(
                SAMPLE_RATE,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT);
        final int min=Math.max(rawMin>0?rawMin:4096,4096);

        lastReadError=0;
        lastSamples=0L;
        lastRms=0.0;
        lastPeak=0;
        lastAudioSource=0;
        lastClientSilenced=false;

        listener.onState("starting",language);

        try{
            // MIC is the most generic source and is first choice. VOICE_RECOGNITION is fallback.
            recorder=openAndStartRecorder(MediaRecorder.AudioSource.MIC,min);
            if(recorder==null)
                recorder=openAndStartRecorder(MediaRecorder.AudioSource.VOICE_RECOGNITION,min);
            if(recorder==null)
                throw new IllegalStateException("AudioRecord init/start failed");

            recording.set(true);
            listener.onState("listening",modelLoading?"model_loading":"model_ready");
            audioWorker.execute(()->recordLoop(min));
        }catch(Throwable t){
            safeRelease();
            recording.set(false);
            listener.onState("audio_open_error",t.getClass().getSimpleName());
            listener.onError("تعذر فتح الميكروفون داخل سند");
        }
    }

    public void onPermissionGranted(){
        if(pendingPermissionStart){
            pendingPermissionStart=false;
            start(language);
            return;
        }
        if(pendingPrepare){
            pendingPrepare=false;
            prepare();
        }
    }

    public void onPermissionDenied(boolean permanent){
        pendingPermissionStart=false;
        pendingPrepare=false;
        listener.onState(permanent?"permission_blocked":"permission_denied",language);
        listener.onError(permanent
                ?"إذن الميكروفون مقفول من إعدادات التطبيق"
                :"صلاحية الميكروفون مطلوبة للصوت");
    }

    private void recordLoop(int bufferSize){
        ByteArrayOutputStream pcm=new ByteArrayOutputStream(SAMPLE_RATE*2*15);
        short[] buf=new short[Math.max(1024,bufferSize/2)];

        long started=SystemClock.elapsedRealtime();
        long lastPartial=0L;
        long silenceSince=0L;

        boolean heardSignal=false;
        boolean lastSpeech=false;
        boolean recovered=false;
        boolean fatalAudioError=false;

        try{
            while(recording.get()){
                AudioRecord current=recorder;
                if(current==null){
                    lastReadError=AudioRecord.ERROR_INVALID_OPERATION;
                    fatalAudioError=true;
                    break;
                }

                int n=current.read(buf,0,buf.length,AudioRecord.READ_BLOCKING);

                // V3.6: stop() only flips the intent flag. If a blocking read wakes because
                // the user requested Stop, do not treat the resulting negative code as a mic
                // failure and do not attempt to reopen AudioRecord. Positive samples are still
                // processed below so the final buffer is not thrown away.
                if(!recording.get() && n<=0) break;

                if(n<0){
                    lastReadError=n;

                    if((n==AudioRecord.ERROR_DEAD_OBJECT || n==AudioRecord.ERROR_INVALID_OPERATION)
                            && !recovered){
                        int fallback=(lastAudioSource==MediaRecorder.AudioSource.MIC)
                                ?MediaRecorder.AudioSource.VOICE_RECOGNITION
                                :MediaRecorder.AudioSource.MIC;

                        safeRelease();
                        recorder=openAndStartRecorder(fallback,bufferSize);

                        if(recorder!=null){
                            recovered=true;
                            lastReadError=0;
                            listener.onState("audio_recovered",String.valueOf(fallback));
                            continue;
                        }
                    }

                    fatalAudioError=true;
                    break;
                }

                if(n==0) continue;

                if(Build.VERSION.SDK_INT>=29){
                    try{
                        AudioRecordingConfiguration cfg=current.getActiveRecordingConfiguration();
                        if(cfg!=null && cfg.isClientSilenced()){
                            lastClientSilenced=true;
                            fatalAudioError=true;
                            break;
                        }
                    }catch(Throwable ignored){}
                }

                double sum=0.0;
                int peak=0;

                for(int i=0;i<n;i++){
                    short s=buf[i];
                    int a=Math.abs((int)s);
                    if(a>peak) peak=a;
                    sum+=(double)s*(double)s;
                    pcm.write(s&0xff);
                    pcm.write((s>>8)&0xff);
                }

                double rms=Math.sqrt(sum/Math.max(1,n));
                lastSamples+=n;
                lastRms=rms;
                if(peak>lastPeak) lastPeak=peak;

                // Low thresholds on purpose: Whisper, not VAD, decides what was spoken.
                boolean signal=(rms>=22.0 || peak>=90);
                boolean speech=(rms>=45.0 || peak>=180);

                float level=(float)Math.min(12.0,
                        Math.max(0.0,20.0*Math.log10((rms+1.0)/90.0)+5.0));
                listener.onLevel(level);

                long now=SystemClock.elapsedRealtime();

                if(signal){
                    heardSignal=true;
                    silenceSince=0L;
                }else if(heardSignal && silenceSince==0L){
                    silenceSince=now;
                }

                if(speech!=lastSpeech){
                    lastSpeech=speech;
                    listener.onState(speech?"speech":"listening",language);
                }

                if(whisperCtx!=0L && signal &&
                        now-lastPartial>=PARTIAL_INTERVAL_MS &&
                        pcm.size()>=SAMPLE_RATE*2){
                    lastPartial=now;
                    schedulePartial(pcm.toByteArray());
                }

                if(heardSignal && silenceSince>0L &&
                        now-silenceSince>=AUTO_STOP_SILENCE_MS &&
                        pcm.size()>=SAMPLE_RATE*2){
                    recording.set(false);
                    break;
                }

                if(now-started>=MAX_SECONDS*1000L){
                    recording.set(false);
                    break;
                }
            }
        }catch(Throwable t){
            // An exception after an intentional Stop is not an AudioRecord failure.
            if(recording.get()){
                fatalAudioError=true;
                if(lastReadError==0) lastReadError=AudioRecord.ERROR;
            }
        }finally{
            safeRelease();
        }

        if(fatalAudioError){
            recording.set(false);
            listener.onState("audio_error",String.valueOf(lastReadError));
            if(lastClientSilenced){
                listener.onError("Android كاتم الميكروفون. فعّل Mic access من إعدادات الخصوصية السريعة.");
            }else{
                listener.onError("فشل قراءة الميكروفون (AudioRecord "+lastReadError+")");
            }
            listener.onState("stopped",language);
            return;
        }

        final byte[] bytes=pcm.toByteArray();

        if(lastSamples==0L){
            listener.onError("الميكروفون اتفتح لكن لم يرجع أي عينات صوت");
            listener.onState("stopped",language);
            return;
        }

        // Android 12+ can legally deliver silent audio when the global mic toggle is off.
        if(bytes.length<SAMPLE_RATE || lastPeak<12){
            listener.onError("الميكروفون بيرجع صوت صامت. تأكد أن Mic access مفعّل في الهاتف.");
            listener.onState("stopped",language);
            return;
        }

        listener.onState("processing",modelLoading?"waiting_model":"transcribing");

        // The warmup task was queued before this final task, so the same single-thread
        // inference executor guarantees model initialization finishes first.
        inferenceWorker.execute(()->{
            try{
                if(whisperCtx==0L){
                    listener.onError("نموذج Whisper المحلي لم يتم تحميله");
                    return;
                }

                String text=transcribe(bytes);
                if(text.isEmpty())
                    listener.onError("وصل الصوت إلى Whisper لكن لم يتم استخراج نص واضح");
                else
                    listener.onDone(text);
            }catch(Throwable t){
                listener.onError("حصل خطأ أثناء تحويل الصوت إلى نص");
            }finally{
                listener.onState("stopped",language);
            }
        });
    }

    private void schedulePartial(byte[] allBytes){
        if(whisperCtx==0L || !partialBusy.compareAndSet(false,true)) return;

        int maxBytes=SAMPLE_RATE*2*10;
        final byte[] snap;

        if(allBytes.length>maxBytes){
            snap=new byte[maxBytes];
            System.arraycopy(allBytes,allBytes.length-maxBytes,snap,0,maxBytes);
        }else{
            snap=allBytes;
        }

        inferenceWorker.execute(()->{
            try{
                if(whisperCtx==0L) return;
                String text=transcribe(snap);
                if(!text.isEmpty()) listener.onResult(text);
            }catch(Throwable ignored){
            }finally{
                partialBusy.set(false);
            }
        });
    }

    private String transcribe(byte[] bytes){
        float[] audio=new float[bytes.length/2];

        for(int i=0,j=0;i+1<bytes.length;i+=2,j++){
            int lo=bytes[i]&0xff;
            int hi=bytes[i+1];
            short s=(short)((hi<<8)|lo);
            audio[j]=s/32768.0f;
        }

        // Normalize quiet phone captures without clipping loud recordings.
        float max=0f;
        for(float v:audio){
            float a=Math.abs(v);
            if(a>max) max=a;
        }

        if(max>0.0004f && max<0.45f){
            float gain=Math.min(8.0f,0.80f/max);
            for(int i=0;i<audio.length;i++)
                audio[i]=Math.max(-1f,Math.min(1f,audio[i]*gain));
        }

        int threads=Math.max(2,Math.min(6,Runtime.getRuntime().availableProcessors()-2));
        String text=WhisperLib.transcribe(whisperCtx,threads,audio,language);

        if(text==null) return "";
        return text.replaceAll("\\s+"," ").trim();
    }

    public void stop(){
        pendingPrepare=false;
        pendingPermissionStart=false;

        // V3.6 Stop ownership rule: UI/API threads only publish stop intent.
        // The audio worker exits its read loop and is the sole owner that stops/releases
        // AudioRecord in safeRelease(). This removes the cross-thread stop/read race.
        recording.set(false);
    }

    private AudioRecord openRecorder(int source,int min){
        try{
            AudioRecord r=new AudioRecord(
                    source,
                    SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    min*4);

            if(r.getState()==AudioRecord.STATE_INITIALIZED){
                lastAudioSource=source;
                return r;
            }

            try{ r.release(); }catch(Throwable ignored){}
        }catch(Throwable ignored){}

        return null;
    }

    private AudioRecord openAndStartRecorder(int source,int min){
        AudioRecord r=openRecorder(source,min);
        if(r==null) return null;

        try{
            r.startRecording();
            if(r.getRecordingState()==AudioRecord.RECORDSTATE_RECORDING){
                lastAudioSource=source;
                return r;
            }
        }catch(Throwable ignored){}

        try{ r.release(); }catch(Throwable ignored){}
        return null;
    }

    private void safeRelease(){
        AudioRecord r=recorder;
        recorder=null;

        if(r!=null){
            try{
                if(r.getRecordingState()==AudioRecord.RECORDSTATE_RECORDING)
                    r.stop();
            }catch(Throwable ignored){}

            try{ r.release(); }catch(Throwable ignored){}
        }
    }

    public void release(){
        stop();

        inferenceWorker.execute(()->{
            long ctx=whisperCtx;
            whisperCtx=0L;
            if(ctx!=0L){
                try{ WhisperLib.freeContext(ctx); }catch(Throwable ignored){}
            }
        });

        audioWorker.shutdown();
        inferenceWorker.shutdown();
    }
}
