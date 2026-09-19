package com.sanad.full;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import java.util.ArrayList;
import java.util.Locale;

/**
 * V3.0 offline-first voice engine.
 * Prefers Android's true on-device recognizer for live partial text.
 * Falls back to bundled whisper.cpp, which also works with no network.
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
    private SpeechRecognizer deviceRecognizer;
    private boolean active=false;
    private boolean usingDevice=false;
    private boolean userStopped=false;
    private boolean pendingStart=false;
    private boolean pendingPrepare=false;
    private String locale="ar-EG";

    public OfflineVoiceEngine(Activity activity, Listener listener){
        this.activity=activity;
        this.listener=listener;
        this.whisper=new WhisperVoiceEngine(activity,new WhisperVoiceEngine.Listener(){
            @Override public void onState(String state,String detail){
                if(usingDevice) return;
                listener.onState(state,detail);
            }
            @Override public void onLevel(float level){
                if(!usingDevice) listener.onLevel(level);
            }
            @Override public void onResult(String text){
                if(!usingDevice && text!=null && !text.trim().isEmpty()) listener.onPartial(text.trim());
            }
            @Override public void onDone(String text){
                if(usingDevice) return;
                active=false;
                listener.onDone(text==null?"":text.trim());
            }
            @Override public void onError(String message){
                if(!usingDevice){ active=false; listener.onError(message); }
            }
        });
        // Warm the bundled fallback silently. It never marks the UI as recording.
        this.whisper.warmup();
    }

    public boolean isRecording(){ return active || whisper.isRecording(); }

    public String status(){
        if(activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED) return "permission_required";
        if(active) return usingDevice?"listening_device":"recording_whisper";
        if(onDeviceAvailable()) return "device_ready";
        return whisper.status();
    }

    public void prepare(){
        if(activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
            pendingPrepare=true;
            listener.onState("permission_required",locale);
            activity.requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},401);
            return;
        }
        pendingPrepare=false;
        listener.onState(onDeviceAvailable()?"device_ready":"ready",locale);
    }

    public void start(String requestedLocale){
        if(active || whisper.isRecording()) return;
        locale=normalizeLocale(requestedLocale);
        if(activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
            pendingStart=true;
            pendingPrepare=false;
            listener.onState("permission_required",locale);
            activity.requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},401);
            return;
        }
        pendingStart=false;
        userStopped=false;
        if(onDeviceAvailable()){
            try{
                startOnDevice();
                return;
            }catch(Throwable ignored){
                destroyDeviceRecognizer();
            }
        }
        startWhisperFallback("on_device_unavailable");
    }

    private boolean onDeviceAvailable(){
        return Build.VERSION.SDK_INT>=31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(activity);
    }

    private void startOnDevice(){
        if(Build.VERSION.SDK_INT<31) throw new IllegalStateException("API");
        destroyDeviceRecognizer();
        usingDevice=true;
        active=true;
        deviceRecognizer=SpeechRecognizer.createOnDeviceSpeechRecognizer(activity);
        deviceRecognizer.setRecognitionListener(new RecognitionListener(){
            @Override public void onReadyForSpeech(Bundle params){ listener.onState("listening_device",locale); }
            @Override public void onBeginningOfSpeech(){ listener.onState("speech",locale); }
            @Override public void onRmsChanged(float rmsdB){ listener.onLevel(Math.max(0f,Math.min(12f,(rmsdB+2f)/1.5f))); }
            @Override public void onBufferReceived(byte[] buffer){}
            @Override public void onEndOfSpeech(){ listener.onState("processing_device",locale); }
            @Override public void onError(int error){
                boolean stopped=userStopped;
                destroyDeviceRecognizer();
                active=false;
                usingDevice=false;
                if(stopped){
                    listener.onDone("");
                    return;
                }
                // Language pack/service errors fall back to bundled Whisper automatically.
                startWhisperFallback("device_error_"+error);
            }
            @Override public void onResults(Bundle results){
                String text=bestResult(results);
                destroyDeviceRecognizer();
                active=false;
                usingDevice=false;
                listener.onDone(text);
            }
            @Override public void onPartialResults(Bundle partialResults){
                String text=bestResult(partialResults);
                if(!text.isEmpty()) listener.onPartial(text);
            }
            @Override public void onEvent(int eventType,Bundle params){}
        });
        Intent i=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE,locale);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE,locale);
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,true);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,3);
        i.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,true);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE,activity.getPackageName());
        listener.onState("starting_device",locale);
        deviceRecognizer.startListening(i);
    }

    private String bestResult(Bundle b){
        if(b==null) return "";
        ArrayList<String> list=b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if(list==null||list.isEmpty()) return "";
        for(String s:list) if(s!=null&&!s.trim().isEmpty()) return s.trim();
        return "";
    }

    private void startWhisperFallback(String reason){
        destroyDeviceRecognizer();
        usingDevice=false;
        active=true;
        listener.onState("fallback_whisper",reason);
        whisper.start(locale);
    }

    public void stop(){
        pendingStart=false;
        pendingPrepare=false;
        userStopped=true;
        if(usingDevice && deviceRecognizer!=null){
            try{ deviceRecognizer.stopListening(); return; }
            catch(Throwable ignored){}
        }
        if(whisper.isRecording()){
            whisper.stop();
            return;
        }
        active=false;
    }

    public void onPermissionGranted(){
        if(pendingStart){
            pendingStart=false;
            start(locale);
        }else if(pendingPrepare){
            pendingPrepare=false;
            prepare();
        }
    }

    public void onPermissionDenied(boolean permanentlyDenied){
        pendingStart=false;
        pendingPrepare=false;
        active=false;
        whisper.onPermissionDenied(permanentlyDenied);
    }

    public void release(){
        active=false;
        userStopped=true;
        destroyDeviceRecognizer();
        whisper.release();
    }

    private void destroyDeviceRecognizer(){
        SpeechRecognizer s=deviceRecognizer;
        deviceRecognizer=null;
        if(s!=null){
            try{s.cancel();}catch(Throwable ignored){}
            try{s.destroy();}catch(Throwable ignored){}
        }
    }

    private String normalizeLocale(String l){
        String x=l==null?"ar-EG":l.trim();
        if(x.toLowerCase(Locale.ROOT).startsWith("en")) return "en-US";
        return "ar-EG";
    }
}
