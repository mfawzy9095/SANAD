package com.sanad.full;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.SystemClock;
import android.os.Build;
import android.media.AudioRecordingConfiguration;

import com.sanad.full.whisper.WhisperLib;

import java.io.ByteArrayOutputStream;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/** V3.3 hardened offline Whisper recorder. */
public final class WhisperVoiceEngine {
    public interface Listener {
        void onState(String state,String detail);
        void onLevel(float level);
        void onResult(String text);
        void onDone(String text);
        void onError(String message);
    }

    private static final int SAMPLE_RATE=16000;
    private static final int MAX_SECONDS=90;
    private static final long PARTIAL_INTERVAL_MS=2200L;
    private static final long AUTO_STOP_SILENCE_MS=1800L;

    private final Activity activity;
    private final Listener listener;
    private final ExecutorService audioWorker=Executors.newSingleThreadExecutor();
    private final ExecutorService inferenceWorker=Executors.newSingleThreadExecutor();
    private final AtomicBoolean recording=new AtomicBoolean(false);
    private final AtomicBoolean partialBusy=new AtomicBoolean(false);

    private volatile AudioRecord recorder;
    private volatile long whisperCtx=0L;
    private volatile boolean modelLoading=false;
    private volatile boolean pendingStart=false;
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

    public boolean isRecording(){return recording.get();}

    public String diagnostics(){
        return "source="+lastAudioSource+
                ";readError="+lastReadError+
                ";samples="+lastSamples+
                ";rms="+String.format(Locale.US,"%.1f",lastRms)+
                ";peak="+lastPeak+
                ";silenced="+lastClientSilenced+
                ";model="+(whisperCtx!=0L?"ready":(modelLoading?"loading":"not_loaded"));
    }

    public String status(){
        if(recording.get())return "recording";
        if(activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED)return "permission_required";
        if(modelLoading)return "loading_model";
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
        if(whisperCtx==0L){listener.onState("loading_model",language);warmup();}
        else listener.onState("ready",language);
    }

    public void warmup(){
        if(whisperCtx!=0L||modelLoading)return;
        modelLoading=true;
        inferenceWorker.execute(()->{
            try{
                long ctx=WhisperLib.initContextFromAsset(activity.getAssets(),"models/ggml-base-q5_1.bin");
                if(ctx==0L)throw new IllegalStateException("model init failed");
                whisperCtx=ctx;
                if(pendingStart){
                    pendingStart=false;
                    activity.runOnUiThread(()->start(language));
                }else listener.onState("ready",language);
            }catch(Throwable t){
                listener.onError("تعذر تشغيل محرك Whisper داخل سند");
            }finally{modelLoading=false;}
        });
    }

    public void start(String locale){
        if(recording.get())return;
        String l=locale==null?"ar":locale.toLowerCase(Locale.ROOT);
        language=l.startsWith("en")?"en":"ar";
        if(activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
            pendingPrepare=false;pendingStart=true;
            listener.onState("permission_required",language);
            activity.requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},401);
            return;
        }
        if(whisperCtx==0L){
            pendingStart=true;
            listener.onState("loading_model",language);
            warmup();
            return;
        }
        int rawMin=AudioRecord.getMinBufferSize(SAMPLE_RATE,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT);
        final int min=Math.max(rawMin>0?rawMin:4096,4096);
        lastReadError=0; lastSamples=0L; lastRms=0.0; lastPeak=0; lastAudioSource=0; lastClientSilenced=false;
        listener.onState("starting",language);
        try{
            recorder=openAndStartRecorder(MediaRecorder.AudioSource.VOICE_RECOGNITION,min);
            if(recorder==null)recorder=openAndStartRecorder(MediaRecorder.AudioSource.MIC,min);
            if(recorder==null)throw new IllegalStateException("audio init/start failed");
            recording.set(true);
            listener.onState("silent",language);
            audioWorker.execute(()->recordLoop(min));
        }catch(Throwable t){
            safeRelease();recording.set(false);
            listener.onError("تعذر فتح الميكروفون");
        }
    }

    public void onPermissionGranted(){
        if(pendingStart){pendingStart=false;start(language);return;}
        if(pendingPrepare){pendingPrepare=false;prepare();}
    }

    public void onPermissionDenied(boolean permanent){
        pendingStart=false;pendingPrepare=false;
        listener.onState(permanent?"permission_blocked":"permission_denied",language);
        listener.onError(permanent?"إذن الميكروفون مقفول من إعدادات التطبيق":"صلاحية الميكروفون مطلوبة للصوت");
    }

    private void recordLoop(int bufferSize){
        ByteArrayOutputStream pcm=new ByteArrayOutputStream(SAMPLE_RATE*2*20);
        short[] buf=new short[Math.max(1024,bufferSize/2)];
        long started=SystemClock.elapsedRealtime(),lastPartial=0L,silenceSince=0L;
        boolean heardSpeech=false,lastSpeech=false,recovered=false,fatalAudioError=false;
        try{
            while(recording.get()){
                AudioRecord current=recorder;
                if(current==null){ lastReadError=AudioRecord.ERROR_INVALID_OPERATION; fatalAudioError=true; break; }
                int n=current.read(buf,0,buf.length,AudioRecord.READ_BLOCKING);
                if(n<0){
                    lastReadError=n;
                    if((n==AudioRecord.ERROR_DEAD_OBJECT || n==AudioRecord.ERROR_INVALID_OPERATION) && !recovered){
                        int fallbackSource=(lastAudioSource==MediaRecorder.AudioSource.VOICE_RECOGNITION)
                                ?MediaRecorder.AudioSource.MIC:MediaRecorder.AudioSource.VOICE_RECOGNITION;
                        safeRelease();
                        recorder=openAndStartRecorder(fallbackSource,bufferSize);
                        if(recorder!=null){
                            recovered=true;
                            lastReadError=0;
                            listener.onState("audio_recovered",String.valueOf(fallbackSource));
                            continue;
                        }
                    }
                    fatalAudioError=true;
                    break;
                }
                if(n==0)continue;
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
                double sum=0;
                int peak=0;
                for(int i=0;i<n;i++){
                    short s=buf[i];
                    int abs=Math.abs((int)s); if(abs>peak)peak=abs;
                    sum+=(double)s*(double)s;
                    pcm.write(s&0xff);pcm.write((s>>8)&0xff);
                }
                double rms=Math.sqrt(sum/Math.max(1,n));
                lastSamples+=n; lastRms=rms; if(peak>lastPeak)lastPeak=peak;
                boolean speech=(rms>=85.0 || peak>=420);
                boolean signal=(rms>=30.0 || peak>=120);
                float level=(float)Math.min(12.0,Math.max(0.0,20.0*Math.log10((rms+1.0)/120.0)+5.0));
                listener.onLevel(level);
                long now=SystemClock.elapsedRealtime();
                if(speech){
                    heardSpeech=true;silenceSince=0L;
                }else if(heardSpeech&&silenceSince==0L) silenceSince=now;
                if(speech!=lastSpeech){lastSpeech=speech;listener.onState(speech?"speech":"silent",language);}
                if(signal && now-lastPartial>=PARTIAL_INTERVAL_MS && pcm.size()>=SAMPLE_RATE*2){
                    lastPartial=now;schedulePartial(pcm.toByteArray());
                }
                if(heardSpeech&&silenceSince>0L&&now-silenceSince>=AUTO_STOP_SILENCE_MS){
                    recording.set(false);break;
                }
                if(now-started>=MAX_SECONDS*1000L){recording.set(false);break;}
            }
        }catch(Throwable t){
            fatalAudioError=true;
            if(lastReadError==0)lastReadError=AudioRecord.ERROR;
        }finally{safeRelease();}

        if(fatalAudioError){
            recording.set(false);
            listener.onState("audio_error",String.valueOf(lastReadError));
            if(lastClientSilenced) listener.onError("الميكروفون مفتوح لكن Android كاتم التسجيل من النظام");
            else listener.onError("فشل قراءة الميكروفون (AudioRecord "+lastReadError+")");
            listener.onState("stopped",language);
            return;
        }

        final byte[] bytes=pcm.toByteArray();
        if(lastSamples==0L){
            listener.onError("الميكروفون اتفتح لكن لم يرجع أي عينات صوت");
            listener.onState("stopped",language);
            return;
        }
        // Do not gate Whisper on an arbitrary VAD threshold. If the microphone returned
        // real non-zero samples for at least ~0.5 s, let the model hear them.
        if(bytes.length<SAMPLE_RATE || lastPeak<20){
            listener.onDone("");listener.onState("stopped",language);return;
        }
        listener.onState("processing",language);
        inferenceWorker.execute(()->{
            try{
                String text=transcribe(bytes,false);
                listener.onDone(text);
            }catch(Throwable t){listener.onError("حصل خطأ أثناء تحويل الصوت إلى نص");}
            finally{listener.onState("stopped",language);}
        });
    }

    private void schedulePartial(byte[] allBytes){
        if(!partialBusy.compareAndSet(false,true))return;
        int maxBytes=SAMPLE_RATE*2*12;
        final byte[] snap;
        if(allBytes.length>maxBytes){
            snap=new byte[maxBytes];
            System.arraycopy(allBytes,allBytes.length-maxBytes,snap,0,maxBytes);
        }else snap=allBytes;
        inferenceWorker.execute(()->{
            try{
                String text=transcribe(snap,true);
                if(!text.isEmpty())listener.onResult(text);
            }catch(Throwable ignored){}finally{partialBusy.set(false);}
        });
    }

    private String transcribe(byte[] bytes,boolean partial){
        float[] audio=new float[bytes.length/2];
        for(int i=0,j=0;i+1<bytes.length;i+=2,j++){
            int lo=bytes[i]&0xff;
            int hi=bytes[i+1];
            short s=(short)((hi<<8)|lo);
            audio[j]=s/32768.0f;
        }
        // Normalize quiet phone captures before Whisper. Cap gain so background noise
        // is not amplified without bound.
        float max=0f;
        for(float v:audio){ float a=Math.abs(v); if(a>max)max=a; }
        if(max>0.001f && max<0.35f){
            float gain=Math.min(6.0f,0.75f/max);
            for(int i=0;i<audio.length;i++) audio[i]=Math.max(-1f,Math.min(1f,audio[i]*gain));
        }
        int threads=Math.max(2,Math.min(6,Runtime.getRuntime().availableProcessors()-2));
        String text=WhisperLib.transcribe(whisperCtx,threads,audio,language);
        if(text==null)return "";
        return text.replaceAll("\\s+"," ").trim();
    }

    public void stop(){
        pendingPrepare=false;
        if(!recording.getAndSet(false)){pendingStart=false;return;}
        AudioRecord r=recorder;
        if(r!=null)try{r.stop();}catch(Throwable ignored){}
    }

    private AudioRecord openRecorder(int source,int min){
        try{
            AudioRecord r=new AudioRecord(source,SAMPLE_RATE,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT,min*2);
            if(r.getState()==AudioRecord.STATE_INITIALIZED){ lastAudioSource=source; return r; }
            try{r.release();}catch(Throwable ignored){}
        }catch(Throwable ignored){}
        return null;
    }

    private AudioRecord openAndStartRecorder(int source,int min){
        AudioRecord r=openRecorder(source,min);
        if(r==null)return null;
        try{
            r.startRecording();
            if(r.getRecordingState()==AudioRecord.RECORDSTATE_RECORDING){
                lastAudioSource=source;
                return r;
            }
        }catch(Throwable ignored){}
        try{r.release();}catch(Throwable ignored){}
        return null;
    }

    private void safeRelease(){
        AudioRecord r=recorder;recorder=null;
        if(r!=null){
            try{if(r.getRecordingState()==AudioRecord.RECORDSTATE_RECORDING)r.stop();}catch(Throwable ignored){}
            try{r.release();}catch(Throwable ignored){}
        }
    }

    public void release(){
        stop();
        inferenceWorker.execute(()->{
            long ctx=whisperCtx;whisperCtx=0L;
            if(ctx!=0L)try{WhisperLib.freeContext(ctx);}catch(Throwable ignored){}
        });
        audioWorker.shutdown();
        inferenceWorker.shutdown();
    }
}
