package com.sanad.full;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.RecognitionSupport;
import android.speech.RecognitionSupportCallback;
import android.speech.SpeechRecognizer;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * V3.3 offline-first voice engine.
 *
 * Path A: Android on-device SpeechRecognizer only when the requested language
 * is confirmed as installed locally.
 * Path B: bundled whisper.cpp fallback with no INTERNET permission.
 *
 * Every recognizer callback is session-scoped so stale callbacks cannot reopen
 * or replace a newer recording session.
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
    private final Handler main=new Handler(Looper.getMainLooper());

    private SpeechRecognizer deviceRecognizer;
    private boolean active=false;
    private boolean usingDevice=false;
    private boolean userStopped=false;
    private boolean pendingStart=false;
    private boolean pendingPrepare=false;
    private boolean lastOnDeviceAvailable=false;
    private String locale="ar-EG";
    private String lastDevicePartial="";

    private int sessionSerial=0;
    private int currentSession=0;
    private int whisperSession=0;

    public OfflineVoiceEngine(Activity activity,Listener listener){
        this.activity=activity;
        this.listener=listener;
        this.whisper=new WhisperVoiceEngine(activity,new WhisperVoiceEngine.Listener(){
            @Override public void onState(String state,String detail){
                if(usingDevice || whisperSession!=currentSession) return;
                listener.onState(state,detail);
            }
            @Override public void onLevel(float level){
                if(!usingDevice && whisperSession==currentSession) listener.onLevel(level);
            }
            @Override public void onResult(String text){
                if(!usingDevice && whisperSession==currentSession && text!=null && !text.trim().isEmpty())
                    listener.onPartial(text.trim());
            }
            @Override public void onDone(String text){
                if(usingDevice || whisperSession!=currentSession) return;
                active=false;
                listener.onDone(text==null?"":text.trim());
            }
            @Override public void onError(String message){
                if(!usingDevice && whisperSession==currentSession){
                    active=false;
                    listener.onError(message);
                }
            }
        });
    }

    public boolean isRecording(){ return active || whisper.isRecording(); }

    public String diagnostics(){
        return "engine="+(usingDevice?"android_on_device":"whisper")+
                ";active="+active+
                ";locale="+locale+
                ";session="+currentSession+
                ";onDeviceAvailable="+lastOnDeviceAvailable+
                ";whisper{"+whisper.diagnostics()+"}";
    }

    public String status(){
        if(activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED)
            return "permission_required";
        if(active) return usingDevice?"listening_device":"recording_whisper";
        if(lastOnDeviceAvailable) return "device_ready";
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
        lastOnDeviceAvailable=onDeviceAvailable();
        listener.onState(lastOnDeviceAvailable?"device_ready":"ready",locale);
    }

    public void start(String requestedLocale){
        if(active || whisper.isRecording()) return;
        locale=normalizeLocale(requestedLocale);
        currentSession=++sessionSerial;
        userStopped=false;
        lastDevicePartial="";
        whisperSession=0;

        if(activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
            pendingStart=true;
            pendingPrepare=false;
            listener.onState("permission_required",locale);
            activity.requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},401);
            return;
        }
        pendingStart=false;
        startInternal(currentSession);
    }

    private void startInternal(final int session){
        if(session!=currentSession || userStopped) return;
        lastOnDeviceAvailable=onDeviceAvailable();
        if(lastOnDeviceAvailable){
            try{
                if(Build.VERSION.SDK_INT>=33) checkAndStartOnDevice(session);
                else startOnDevice(session,locale);
                return;
            }catch(Throwable ignored){
                destroyDeviceRecognizer(true);
            }
        }
        startWhisperFallback(session,"on_device_unavailable",0L);
    }

    private boolean onDeviceAvailable(){
        return Build.VERSION.SDK_INT>=31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(activity);
    }

    private Intent buildRecognizerIntent(String requestedLocale){
        Intent i=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE,requestedLocale);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE,requestedLocale);
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,true);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,3);
        i.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,true);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE,activity.getPackageName());
        return i;
    }

    private void checkAndStartOnDevice(final int session){
        if(Build.VERSION.SDK_INT<33){ startOnDevice(session,locale); return; }
        destroyDeviceRecognizer(true);
        usingDevice=true;
        active=true;
        userStopped=false;

        deviceRecognizer=SpeechRecognizer.createOnDeviceSpeechRecognizer(activity);
        final SpeechRecognizer recognizer=deviceRecognizer;
        final Intent supportIntent=buildRecognizerIntent(locale);
        listener.onState("checking_device",locale);

        recognizer.checkRecognitionSupport(supportIntent,activity.getMainExecutor(),new RecognitionSupportCallback(){
            @Override public void onSupportResult(RecognitionSupport support){
                if(!isSameDeviceSession(session,recognizer) || userStopped) return;
                String installed=chooseInstalledLocale(support.getInstalledOnDeviceLanguages(),locale);
                if(installed!=null){
                    try{
                        attachListenerAndStart(session,recognizer,buildRecognizerIntent(installed),installed);
                    }catch(Throwable startError){
                        if(!isSameDeviceSession(session,recognizer)) return;
                        destroyDeviceRecognizer(true);
                        active=false; usingDevice=false;
                        startWhisperFallback(session,"device_start_failed",220L);
                    }
                }else{
                    destroyDeviceRecognizer(false);
                    active=false; usingDevice=false;
                    startWhisperFallback(session,"language_not_installed",180L);
                }
            }
            @Override public void onError(int error){
                if(!isSameDeviceSession(session,recognizer) || userStopped) return;
                destroyDeviceRecognizer(false);
                active=false; usingDevice=false;
                startWhisperFallback(session,"support_check_"+error,180L);
            }
        });
    }

    private String chooseInstalledLocale(List<String> installed,String wanted){
        if(installed==null||installed.isEmpty()) return null;
        String w=normalizeTag(wanted);
        for(String s:installed){
            if(s!=null && normalizeTag(s).equals(w)) return s;
        }
        String base=w.contains("-")?w.substring(0,w.indexOf('-')):w;
        for(String s:installed){
            if(s==null) continue;
            String x=normalizeTag(s);
            if(x.equals(base)||x.startsWith(base+"-")) return s;
        }
        return null;
    }

    private String normalizeTag(String s){
        return (s==null?"":s.trim().toLowerCase(Locale.ROOT).replace('_','-'));
    }

    private void startOnDevice(final int session,String deviceLocale){
        if(Build.VERSION.SDK_INT<31) throw new IllegalStateException("API");
        destroyDeviceRecognizer(true);
        usingDevice=true;
        active=true;
        userStopped=false;
        deviceRecognizer=SpeechRecognizer.createOnDeviceSpeechRecognizer(activity);
        attachListenerAndStart(session,deviceRecognizer,buildRecognizerIntent(deviceLocale),deviceLocale);
    }

    private void attachListenerAndStart(final int session,final SpeechRecognizer recognizer,
                                        final Intent intent,final String deviceLocale){
        recognizer.setRecognitionListener(new RecognitionListener(){
            @Override public void onReadyForSpeech(Bundle params){
                if(isActiveDeviceSession(session,recognizer)) listener.onState("listening_device",deviceLocale);
            }
            @Override public void onBeginningOfSpeech(){
                if(isActiveDeviceSession(session,recognizer)) listener.onState("speech",deviceLocale);
            }
            @Override public void onRmsChanged(float rmsdB){
                if(isActiveDeviceSession(session,recognizer))
                    listener.onLevel(Math.max(0f,Math.min(12f,(rmsdB+2f)/1.5f)));
            }
            @Override public void onBufferReceived(byte[] buffer){}
            @Override public void onEndOfSpeech(){
                if(isActiveDeviceSession(session,recognizer)) listener.onState("processing_device",deviceLocale);
            }
            @Override public void onError(int error){
                if(!isSameDeviceSession(session,recognizer)) return;
                boolean stopped=userStopped;
                String partial=lastDevicePartial;
                destroyDeviceRecognizer(false);
                active=false;
                usingDevice=false;
                if(stopped){
                    listener.onDone(partial==null?"":partial);
                    return;
                }
                // Release the recognition service before opening AudioRecord for Whisper.
                startWhisperFallback(session,"device_error_"+error,220L);
            }
            @Override public void onResults(Bundle results){
                if(!isSameDeviceSession(session,recognizer)) return;
                String text=bestResult(results);
                if(text.isEmpty()) text=lastDevicePartial;
                destroyDeviceRecognizer(false);
                active=false;
                usingDevice=false;
                if(text==null||text.trim().isEmpty())
                    listener.onError("التعرف المحلي لم يرجع نص واضح");
                else
                    listener.onDone(text.trim());
            }
            @Override public void onPartialResults(Bundle partialResults){
                if(!isSameDeviceSession(session,recognizer)) return;
                String text=bestResult(partialResults);
                if(!text.isEmpty()){
                    lastDevicePartial=text;
                    listener.onPartial(text);
                }
            }
            @Override public void onEvent(int eventType,Bundle params){}
        });

        if(!isActiveDeviceSession(session,recognizer)) return;
        listener.onState("starting_device",deviceLocale);
        recognizer.startListening(intent);
    }

    private boolean isSameDeviceSession(int session,SpeechRecognizer recognizer){
        return session==currentSession && recognizer!=null && recognizer==deviceRecognizer;
    }

    private boolean isActiveDeviceSession(int session,SpeechRecognizer recognizer){
        return isSameDeviceSession(session,recognizer) && !userStopped;
    }

    private String bestResult(Bundle b){
        if(b==null) return "";
        ArrayList<String> list=b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if(list==null||list.isEmpty()) return "";
        for(String s:list) if(s!=null&&!s.trim().isEmpty()) return s.trim();
        return "";
    }

    private void startWhisperFallback(final int session,final String reason,long delayMs){
        destroyDeviceRecognizer(false);
        usingDevice=false;
        active=true;
        listener.onState("fallback_whisper",reason);

        Runnable start=()->{
            if(session!=currentSession || userStopped){
                if(session==currentSession) active=false;
                return;
            }
            whisperSession=session;
            whisper.start(locale);
        };
        if(delayMs>0L) main.postDelayed(start,delayMs); else start.run();
    }

    public void stop(){
        pendingStart=false;
        pendingPrepare=false;
        userStopped=true;

        if(usingDevice && deviceRecognizer!=null){
            final int session=currentSession;
            final SpeechRecognizer recognizer=deviceRecognizer;
            try{ recognizer.stopListening(); }
            catch(Throwable ignored){
                destroyDeviceRecognizer(true);
                active=false; usingDevice=false;
                listener.onDone(lastDevicePartial==null?"":lastDevicePartial);
                return;
            }
            // Some OEM recognizers never return onResults after stopListening().
            main.postDelayed(()->{
                if(session==currentSession && recognizer==deviceRecognizer && active){
                    String partial=lastDevicePartial;
                    destroyDeviceRecognizer(true);
                    active=false; usingDevice=false;
                    listener.onDone(partial==null?"":partial);
                }
            },2800L);
            return;
        }

        // Always call stop(): it also cancels a pending Whisper start while its model is loading.
        whisper.stop();
        if(!whisper.isRecording()) active=false;
    }

    public void onPermissionGranted(){
        if(pendingStart){
            pendingStart=false;
            userStopped=false;
            startInternal(currentSession);
        }else if(pendingPrepare){
            pendingPrepare=false;
            prepare();
        }
    }

    public void onPermissionDenied(boolean permanentlyDenied){
        pendingStart=false;
        pendingPrepare=false;
        userStopped=true;
        active=false;
        whisper.stop();
        whisper.onPermissionDenied(permanentlyDenied);
    }

    public void release(){
        pendingStart=false;
        pendingPrepare=false;
        userStopped=true;
        currentSession=++sessionSerial;
        active=false;
        usingDevice=false;
        destroyDeviceRecognizer(true);
        whisper.stop();
        whisper.release();
    }

    private void destroyDeviceRecognizer(boolean cancel){
        SpeechRecognizer s=deviceRecognizer;
        deviceRecognizer=null;
        if(s!=null){
            if(cancel){
                try{s.cancel();}catch(Throwable ignored){}
            }
            try{s.destroy();}catch(Throwable ignored){}
        }
    }

    private String normalizeLocale(String l){
        String x=l==null?"ar-EG":l.trim();
        if(x.toLowerCase(Locale.ROOT).startsWith("en")) return "en-US";
        return "ar-EG";
    }
}
