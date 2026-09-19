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

    public WhisperVoiceEngine(Activity activity,Listener listener){
        this.activity=activity;
        this.listener=listener;
    }

    public boolean isRecording(){return recording.get();}

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
        listener.onState("starting",language);
        try{
            recorder=openRecorder(MediaRecorder.AudioSource.VOICE_RECOGNITION,min);
            if(recorder==null)recorder=openRecorder(MediaRecorder.AudioSource.MIC,min);
            if(recorder==null)throw new IllegalStateException("audio init");
            recorder.startRecording();
            if(recorder.getRecordingState()!=AudioRecord.RECORDSTATE_RECORDING)throw new IllegalStateException("audio did not start");
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
        boolean heardSpeech=false,lastSpeech=false;
        try{
            while(recording.get()){
                int n=recorder.read(buf,0,buf.length);
                if(n<0)break;
                if(n==0)continue;
                double sum=0;
                for(int i=0;i<n;i++){
                    short s=buf[i];
                    sum+=(double)s*(double)s;
                    pcm.write(s&0xff);pcm.write((s>>8)&0xff);
                }
                double rms=Math.sqrt(sum/Math.max(1,n));
                boolean speech=rms>=220.0;
                float level=(float)Math.min(12.0,Math.max(0.0,20.0*Math.log10((rms+1.0)/160.0)+5.0));
                listener.onLevel(level);
                long now=SystemClock.elapsedRealtime();
                if(speech){
                    heardSpeech=true;silenceSince=0L;
                }else if(heardSpeech&&silenceSince==0L) silenceSince=now;
                if(speech!=lastSpeech){lastSpeech=speech;listener.onState(speech?"speech":"silent",language);}
                if(heardSpeech && now-lastPartial>=PARTIAL_INTERVAL_MS && pcm.size()>=SAMPLE_RATE*2){
                    lastPartial=now;schedulePartial(pcm.toByteArray());
                }
                if(heardSpeech&&silenceSince>0L&&now-silenceSince>=AUTO_STOP_SILENCE_MS){
                    recording.set(false);break;
                }
                if(now-started>=MAX_SECONDS*1000L){recording.set(false);break;}
            }
        }catch(Throwable ignored){}finally{safeRelease();}

        final byte[] bytes=pcm.toByteArray();
        if(!heardSpeech||bytes.length<SAMPLE_RATE){
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
        int threads=Math.max(2,Math.min(6,Runtime.getRuntime().availableProcessors()-2));
        String text=WhisperLib.transcribe(whisperCtx,threads,audio,language);
        if(text==null)return "";
        return text.replaceAll("\\s+"," ").trim();
    }

    public void stop(){
        if(!recording.getAndSet(false)){pendingStart=false;return;}
        AudioRecord r=recorder;
        if(r!=null)try{r.stop();}catch(Throwable ignored){}
    }

    private AudioRecord openRecorder(int source,int min){
        try{
            AudioRecord r=new AudioRecord(source,SAMPLE_RATE,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT,min*2);
            if(r.getState()==AudioRecord.STATE_INITIALIZED)return r;
            try{r.release();}catch(Throwable ignored){}
        }catch(Throwable ignored){}
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
