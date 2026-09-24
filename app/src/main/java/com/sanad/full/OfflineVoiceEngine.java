package com.sanad.full;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;

/**
 * Cloud Whisper when configured and online, bundled Whisper otherwise.
 */
public final class OfflineVoiceEngine {
    public interface Listener {
        void onState(String state,String detail);
        void onLevel(float level);
        void onPartial(String text);
        void onDone(String text);
        void onError(String message);
    }

    private final Activity activity;
    private final Listener listener;
    private final WhisperVoiceEngine whisper;

    public OfflineVoiceEngine(Activity activity, Listener listener){
        this.activity=activity;
        this.listener=listener;
        this.whisper=new WhisperVoiceEngine(activity,new WhisperVoiceEngine.Listener(){
            @Override public void onState(String state,String detail){ listener.onState(state,detail); }
            @Override public void onLevel(float level){ listener.onLevel(level); }
            @Override public void onResult(String text){
                if(text!=null&&!text.trim().isEmpty()) listener.onPartial(text.trim());
            }
            @Override public void onDone(String text){ listener.onDone(text==null?"":text.trim()); }
            @Override public void onError(String message){ listener.onError(message); }
        });
    }

    public boolean isRecording(){ return whisper.isRecording(); }

    public String diagnostics(){
        return "engine=hybrid_whisper;"+whisper.diagnostics();
    }

    public String status(){
        if(activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED)
            return "permission_required";
        return whisper.status();
    }

    public void prepare(){ whisper.prepare(); }

    public void start(String locale){ whisper.start(locale); }

    public void stop(){ whisper.stop(); }

    public void onPermissionGranted(){ whisper.onPermissionGranted(); }

    public void onPermissionDenied(boolean permanentlyDenied){ whisper.onPermissionDenied(permanentlyDenied); }

    public void release(){ whisper.release(); }
}
