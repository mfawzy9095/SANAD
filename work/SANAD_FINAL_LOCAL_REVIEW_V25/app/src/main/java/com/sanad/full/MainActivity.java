package com.sanad.full;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.speech.*;
import android.webkit.*;
import android.widget.Toast;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

public class MainActivity extends Activity {
    private static MainActivity current;
    private WebView web;
    private SanadDatabase db;
    private WhisperVoiceEngine whisperVoice;
    private SpeechRecognizer recognizer;
    private String voiceLocale="ar-EG";
    private int voiceRetry=0;
    private int voiceLocaleIndex=0;
    private int voiceDisconnectRetry=0;
    private boolean voiceRetrying=false;
    private boolean voiceSessionActive=false;
    private boolean voiceCycleActive=false;
    private int voiceBusyRetry=0;
    private long voiceSessionStartedAt=0L;
    private boolean smsImportRunning=false;
    private static final int REQ_AUDIO=401, REQ_SMS=402, REQ_EXPORT=403, REQ_IMPORT=404;
    private String pendingExport;
    private int pendingSmsDays=120;
    private boolean bankDrainInProgress=false;

    @Override protected void onCreate(Bundle b){
        super.onCreate(b); current=this; db=new SanadDatabase(this); setupWeb();
        whisperVoice=new WhisperVoiceEngine(this,new WhisperVoiceEngine.Listener(){
            @Override public void onState(String state,String detail){ js("window.sanadNativeVoiceState("+JSONObject.quote(state)+","+JSONObject.quote(detail==null?"":detail)+")"); }
            @Override public void onLevel(float level){ js("window.sanadNativeVoiceLevel("+level+")"); }
            @Override public void onResult(String text){ JSONArray a=new JSONArray(); a.put(text==null?"":text); js("window.sanadNativeVoiceChunk("+JSONObject.quote(a.toString())+")"); }
            @Override public void onDone(String text){ js("window.sanadNativeVoiceDone("+JSONObject.quote(text==null?"":text)+")"); }
            @Override public void onError(String message){ js("window.sanadNativeVoiceError("+JSONObject.quote(message==null?"خطأ في الصوت":message)+")"); }
        });
    }
    @Override protected void onResume(){
        super.onResume();
        if(web!=null) runOnUiThread(this::drainPending);
    }
    @Override protected void onDestroy(){
        if(current==this) current=null;
        voiceSessionActive=false; voiceCycleActive=false;
        if(whisperVoice!=null){ try{whisperVoice.release();}catch(Exception ignored){} }
        if(recognizer!=null){ try{recognizer.cancel(); recognizer.destroy();}catch(Exception ignored){} }
        if(web!=null){ try{web.removeJavascriptInterface("Android"); web.destroy();}catch(Exception ignored){} }
        super.onDestroy();
    }

    private void setupWeb(){
        web=new WebView(this); setContentView(web);
        WebSettings s=web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // kept only for one-time migration from older SANAD WebView builds
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setBlockNetworkLoads(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.setWebViewClient(new WebViewClient(){
            @Override public void onPageFinished(WebView view,String url){
                super.onPageFinished(view,url);
                CairoWebFontLoader.load(MainActivity.this, web);
                drainPending();
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(),"Android");
        web.loadUrl("file:///android_asset/index.html");
    }

    private void js(String code){
        runOnUiThread(()->{ if(web!=null) web.evaluateJavascript(code,null); });
    }
    public static void requestPendingBankDrainIfOpen(){
        MainActivity a=current; if(a!=null) a.runOnUiThread(a::drainPending);
    }

    public final class Bridge {
        @JavascriptInterface public boolean saveState(String json){
            try{ db.saveState(json); return true; }
            catch(Exception e){ toast("تعذر حفظ البيانات المشفرة"); return false; }
        }
        @JavascriptInterface public String loadState(){
            try{ String state=db.loadState(); return state==null?"":state; }
            catch(Exception e){ toast("تعذر قراءة البيانات المشفرة"); return ""; }
        }
        @JavascriptInterface public boolean clearState(){
            try{
                db.clearState();
                try{ CryptoStore.deleteKey(); }catch(Exception ignored){}
                getSharedPreferences("sanad_prefs",MODE_PRIVATE).edit()
                    .remove("sms_sync_initialized").remove("sms_sync_last_date").remove("sms_sync_last_id").apply();
                return true;
            }catch(Exception e){ toast("تعذر حذف البيانات المحلية"); return false; }
        }
        @JavascriptInterface public void startVoice(String locale){
            runOnUiThread(()->{ if(whisperVoice!=null) whisperVoice.start(); });
        }
        @JavascriptInterface public void stopVoice(){ runOnUiThread(()->{ if(whisperVoice!=null) whisperVoice.stop(); }); }
        @JavascriptInterface public void importBankSms(int days){
            pendingSmsDays=days<=0?0:Math.max(1,Math.min(days,3650));
            runOnUiThread(()->beginSmsSync(false));
        }
        @JavascriptInterface public void refreshBankSms(){ runOnUiThread(()->beginSmsSync(false)); }
        @JavascriptInterface public void fullResyncBankSms(){ runOnUiThread(()->beginSmsSync(true)); }
        @JavascriptInterface public void drainPendingBankMessages(){ runOnUiThread(MainActivity.this::drainPending); }
        @JavascriptInterface public void ensureBankCaptureAccess(){
            runOnUiThread(()->{ if(!notificationAccessEnabled()) startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)); });
        }
        @JavascriptInterface public void openNotificationAccess(){
            runOnUiThread(()->startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)));
        }
        @JavascriptInterface public void exportBackup(String json){
            runOnUiThread(()->{
                pendingExport=json;
                Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE); i.setType("application/json");
                i.putExtra(Intent.EXTRA_TITLE,"sanad-backup-"+java.time.LocalDate.now()+".json");
                startActivityForResult(i,REQ_EXPORT);
            });
        }
        @JavascriptInterface public void importBackup(){
            runOnUiThread(()->{
                Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE); i.setType("application/json");
                startActivityForResult(i,REQ_IMPORT);
            });
        }
    }

    private String[] voiceLocaleCandidates(){
        String v=voiceLocale==null?"":voiceLocale.toLowerCase(Locale.ROOT);
        if(v.startsWith("ar")) return new String[]{"ar-EG","ar-AE","ar-SA","ar"};
        if(v.startsWith("en")) return new String[]{"en-US","en-GB","en"};
        return new String[]{voiceLocale};
    }
    private String currentVoiceLocale(){
        String[] c=voiceLocaleCandidates();
        int i=Math.max(0,Math.min(voiceLocaleIndex,c.length-1));
        return c[i];
    }
    private void jsVoiceState(String state,String detail){
        js("window.sanadNativeVoiceState("+JSONObject.quote(state)+","+JSONObject.quote(detail==null?"":detail)+")");
    }
    private void resolveVoiceLocaleAndStart(){
        if(!voiceSessionActive) return;
        if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},REQ_AUDIO); return;
        }
        if(Build.VERSION.SDK_INT<31 || !SpeechRecognizer.isOnDeviceRecognitionAvailable(this)){
            voiceSessionActive=false;
            js("window.sanadNativeVoiceError("+JSONObject.quote("التعرف الصوتي Offline غير متاح من محرك Android على هذا الجهاز. ثبّت/حدّث Speech Services وحزمة العربية المحلية ثم جرّب مرة أخرى.")+")");
            return;
        }
        // Android 13+: ask the on-device recognizer which languages are actually installed.
        if(Build.VERSION.SDK_INT>=33){
            try{
                SpeechRecognizer probe=SpeechRecognizer.createOnDeviceSpeechRecognizer(this);
                Intent q=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                q.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                q.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,true);
                probe.checkRecognitionSupport(q,getMainExecutor(),new RecognitionSupportCallback(){
                    @Override public void onSupportResult(RecognitionSupport support){
                        try{
                            String wanted=(voiceLocale==null?"ar":voiceLocale).toLowerCase(Locale.ROOT).split("-")[0];
                            String chosen=null;
                            List<String> installed=support.getInstalledOnDeviceLanguages();
                            if(installed!=null) for(String lang:installed){ if(lang!=null && lang.toLowerCase(Locale.ROOT).startsWith(wanted)){ chosen=lang; break; } }
                            if(chosen!=null){ voiceLocale=chosen; voiceLocaleIndex=0; jsVoiceState("ready_locale",chosen); beginVoiceCycle(); }
                            else {
                                String downloadable=null; List<String> supported=support.getSupportedOnDeviceLanguages();
                                if(supported!=null) for(String lang:supported){ if(lang!=null && lang.toLowerCase(Locale.ROOT).startsWith(wanted)){ downloadable=lang; break; } }
                                if(downloadable!=null){ voiceLocale=downloadable; requestVoiceModelDownload(); voiceSessionActive=false; js("window.sanadNativeVoiceError("+JSONObject.quote("العربية مدعومة على الجهاز لكنها غير مُنزلة للتعرف Offline. طلبت من Android تنزيل الحزمة؛ بعد اكتمالها اضغط الميكروفون مرة أخرى.")+")"); }
                                else beginVoiceCycle(); // Some engines do not report lists correctly; try recognition before declaring unsupported.
                            }
                        } finally { try{probe.destroy();}catch(Exception ignored){} }
                    }
                    @Override public void onError(int error){ try{probe.destroy();}catch(Exception ignored){} beginVoiceCycle(); }
                });
                return;
            }catch(Exception ignored){}
        }
        beginVoiceCycle();
    }
    private boolean tryNextVoiceLocale(){
        String[] c=voiceLocaleCandidates();
        if(voiceLocaleIndex+1>=c.length) return false;
        voiceLocaleIndex++; voiceRetry=0; voiceDisconnectRetry=0; voiceBusyRetry=0; voiceRetrying=true;
        recreateRecognizerThen(450);
        return true;
    }
    private void requestVoiceModelDownload(){
        if(Build.VERSION.SDK_INT<33) return;
        try{
            SpeechRecognizer prep=SpeechRecognizer.createOnDeviceSpeechRecognizer(this);
            prep.triggerModelDownload(voiceIntent(currentVoiceLocale())); prep.destroy();
        }catch(Exception ignored){}
    }
    private void recreateRecognizerThen(long delay){
        voiceCycleActive=false;
        try{ if(recognizer!=null){ recognizer.cancel(); recognizer.destroy(); } }catch(Exception ignored){}
        recognizer=null;
        if(voiceSessionActive) new Handler(Looper.getMainLooper()).postDelayed(this::beginVoiceCycle,delay);
    }
    private void scheduleNextVoiceCycle(long delay){
        voiceCycleActive=false;
        if(!voiceSessionActive) return;
        new Handler(Looper.getMainLooper()).postDelayed(()->{ if(voiceSessionActive&&!voiceCycleActive) beginVoiceCycle(); },delay);
    }
    private void stopVoiceSession(){
        voiceSessionActive=false; voiceCycleActive=false; voiceRetrying=false; voiceRetry=0; voiceDisconnectRetry=0; voiceBusyRetry=0;
        try{ if(recognizer!=null){ recognizer.cancel(); recognizer.destroy(); } }catch(Exception ignored){}
        recognizer=null; jsVoiceState("stopped","");
    }
    private void beginVoiceCycle(){
        if(!voiceSessionActive || voiceCycleActive) return;
        if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},REQ_AUDIO); return;
        }
        if(Build.VERSION.SDK_INT<31 || !SpeechRecognizer.isOnDeviceRecognitionAvailable(this)){
            voiceSessionActive=false; js("window.sanadNativeVoiceError("+JSONObject.quote("التعرف الصوتي Offline غير متاح على الجهاز")+")"); return;
        }
        try{
            if(recognizer==null) recognizer=SpeechRecognizer.createOnDeviceSpeechRecognizer(this);
            recognizer.setRecognitionListener(new RecognitionListener(){
                public void onReadyForSpeech(Bundle p){ voiceCycleActive=true; voiceRetrying=false; voiceBusyRetry=0; jsVoiceState("silent",currentVoiceLocale()); }
                public void onBeginningOfSpeech(){ jsVoiceState("speech",""); }
                public void onRmsChanged(float r){ js("window.sanadNativeVoiceLevel("+Math.max(-2f,Math.min(12f,r))+")"); }
                public void onBufferReceived(byte[] b){}
                public void onEndOfSpeech(){ jsVoiceState("processing",""); }
                public void onError(int error){
                    voiceCycleActive=false;
                    if(!voiceSessionActive) return;
                    if(error==SpeechRecognizer.ERROR_NO_MATCH || error==SpeechRecognizer.ERROR_SPEECH_TIMEOUT){ jsVoiceState("silent",""); scheduleNextVoiceCycle(220); return; }
                    if(error==SpeechRecognizer.ERROR_RECOGNIZER_BUSY){
                        voiceBusyRetry++;
                        jsVoiceState("restarting","");
                        recreateRecognizerThen(Math.min(1600,450L+voiceBusyRetry*250L));
                        return;
                    }
                    if(error==SpeechRecognizer.ERROR_SERVER_DISCONNECTED){
                        voiceDisconnectRetry++;
                        jsVoiceState("restarting","11");
                        if(voiceDisconnectRetry<=2){ recreateRecognizerThen(650L*voiceDisconnectRetry); return; }
                        if(tryNextVoiceLocale()) return;
                        voiceSessionActive=false; js("window.sanadNativeVoiceError("+JSONObject.quote("محرك التعرف الصوتي المحلي يفصل من Android باستمرار (11). حدّث Speech Services أو أعد تشغيل الهاتف ثم جرّب.")+")"); return;
                    }
                    if(error==SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED){
                        if(tryNextVoiceLocale()) return;
                        voiceSessionActive=false; js("window.sanadNativeVoiceError("+JSONObject.quote("لم أجد حزمة عربية Offline مثبتة يدعمها محرك التعرف الحالي. افتح إعدادات Speech Services ونزّل العربية.")+")"); return;
                    }
                    if(Build.VERSION.SDK_INT>=31 && error==SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE){
                        requestVoiceModelDownload(); voiceSessionActive=false;
                        js("window.sanadNativeVoiceError("+JSONObject.quote("حزمة العربية Offline غير متاحة محليًا بعد. طلبت من Android تجهيزها؛ جرّب بعد اكتمال التنزيل.")+")"); return;
                    }
                    voiceSessionActive=false; js("window.sanadNativeVoiceError("+JSONObject.quote(voiceError(error))+")");
                }
                public void onPartialResults(Bundle b){
                    ArrayList<String> a=b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if(a!=null&&!a.isEmpty()) js("window.sanadNativeVoicePartial("+JSONObject.quote(a.get(0))+")");
                }
                public void onResults(Bundle b){
                    voiceCycleActive=false; voiceRetry=0; voiceDisconnectRetry=0; voiceBusyRetry=0;
                    ArrayList<String> a=b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    JSONArray j=new JSONArray(); if(a!=null) for(String x:a) j.put(x);
                    js("window.sanadNativeVoiceChunk("+JSONObject.quote(j.toString())+")");
                    scheduleNextVoiceCycle(260);
                }
                public void onEvent(int e,Bundle b){}
                public void onSegmentResults(Bundle b){}
                public void onEndOfSegmentedSession(){}
                public void onLanguageDetection(Bundle b){}
            });
            voiceCycleActive=true; jsVoiceState("starting",currentVoiceLocale()); recognizer.startListening(voiceIntent(currentVoiceLocale()));
        }catch(Exception e){
            voiceCycleActive=false;
            if(voiceSessionActive){ voiceBusyRetry++; recreateRecognizerThen(Math.min(1800,500L+voiceBusyRetry*250L)); }
        }
    }
    private Intent voiceIntent(){ return voiceIntent(currentVoiceLocale()); }
    private Intent voiceIntent(String locale){
        Intent i=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE,locale);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE,locale);
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,true);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,5);
        i.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,true);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS,1400L);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS,850L);
        return i;
    }
    private String voiceError(int e){
        if(e==SpeechRecognizer.ERROR_NO_MATCH) return "لم ألتقط الجملة بوضوح";
        if(e==SpeechRecognizer.ERROR_SPEECH_TIMEOUT) return "لم يتم سماع كلام";
        if(e==SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) return "صلاحية الميكروفون مطلوبة";
        if(e==SpeechRecognizer.ERROR_RECOGNIZER_BUSY) return "محرك التعرف الصوتي مشغول";
        if(e==SpeechRecognizer.ERROR_SERVER_DISCONNECTED) return "محرك التعرف الصوتي المحلي فصل من Android (11)";
        if(e==SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED) return "لغة التعرف الصوتي المحلي غير مدعومة (12)";
        if(Build.VERSION.SDK_INT>=31 && e==SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE) return "حزمة اللغة المحلية غير متاحة حاليًا (13)";
        return "خطأ في التعرف الصوتي المحلي ("+e+")";
    }

    private void maybePromptNotificationAccess(){
        if(notificationAccessEnabled()) return;
        android.content.SharedPreferences prefs=getSharedPreferences("sanad_prefs",MODE_PRIVATE);
        long now=System.currentTimeMillis();
        long last=prefs.getLong("notif_prompt_last",0L);
        // "Later" is not permanent: SANAD may ask again after three days, or the user can open access manually anytime.
        if(last>0 && now-last<3L*24L*60L*60L*1000L) return;
        AlertDialog dialog=new AlertDialog.Builder(this)
            .setTitle("التقاط معاملات البنك الجديدة")
            .setMessage("لتسجيل إشعارات معاملات البنك الجديدة تلقائيًا على الجهاز، فعّل وصول الإشعارات لسند. لا يتم إرسال الرسائل لأي خادم.")
            .setNegativeButton("لاحقًا",(d,w)->prefs.edit().putLong("notif_prompt_last",System.currentTimeMillis()).apply())
            .setPositiveButton("فتح الإعدادات",(d,w)->{
                prefs.edit().putLong("notif_prompt_last",System.currentTimeMillis()).apply();
                startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
            })
            .create();
        dialog.setOnCancelListener(d->prefs.edit().putLong("notif_prompt_last",System.currentTimeMillis()).apply());
        dialog.show();
    }
    private boolean notificationAccessEnabled(){
        String flat=Settings.Secure.getString(getContentResolver(),"enabled_notification_listeners");
        if(flat==null||flat.trim().isEmpty()) return false;
        String[] parts=flat.split(":");
        for(String part:parts){
            ComponentName cn=ComponentName.unflattenFromString(part);
            if(cn!=null && getPackageName().equals(cn.getPackageName())) return true;
        }
        return false;
    }

    private void beginSmsSync(boolean forceFull){
        if(checkSelfPermission(Manifest.permission.READ_SMS)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(new String[]{Manifest.permission.READ_SMS},REQ_SMS); return;
        }
        if(smsImportRunning) return;
        startSmsSyncThread(forceFull);
    }
    private void startSmsSyncThread(boolean forceFull){
        smsImportRunning=true;
        new Thread(()->{
            try{ syncSms(forceFull); }
            finally{ smsImportRunning=false; runOnUiThread(this::maybePromptNotificationAccess); }
        },"sanad-sms-sync").start();
    }
    private void syncSms(boolean forceFull){
        JSONArray arr=new JSONArray();
        android.content.SharedPreferences prefs=getSharedPreferences("sanad_prefs",MODE_PRIVATE);
        boolean initialized=prefs.getBoolean("sms_sync_initialized",false);
        boolean full=forceFull||!initialized;
        long lastDate=prefs.getLong("sms_sync_last_date",0L);
        long after=full?0L:Math.max(0L,lastDate-5L*60L*1000L); // overlap is safe because hashes/source keys dedupe
        HashSet<String> batch=new HashSet<>(); int accepted=0; long maxDate=lastDate; long maxId=prefs.getLong("sms_sync_last_id",0L);
        String sel=full?null:"date>=?"; String[] args=full?null:new String[]{String.valueOf(after)};
        try(Cursor c=getContentResolver().query(Uri.parse("content://sms/inbox"),new String[]{"_id","address","body","date"},sel,args,"date DESC")){
            if(c!=null) while(c.moveToNext()){
                long smsId=c.getLong(0); String sender=c.getString(1); String body=c.getString(2); long smsDate=c.getLong(3);
                if(smsDate>maxDate){ maxDate=smsDate; maxId=smsId; }
                if(!BankMessageFilter.isFinancial(body)) continue;
                String h=BankMessageFilter.messageFingerprint(body,smsDate,smsId,sender); if(!batch.add(h)) continue;
                JSONObject o=new JSONObject(); o.put("sender",sender); o.put("text",body); o.put("date",smsDate); o.put("hash",h);
                arr.put(o); accepted++;
                if(accepted>=5000) break; // safety only; normal personal inboxes are far below this
            }
            prefs.edit().putBoolean("sms_sync_initialized",true).putLong("sms_sync_last_date",maxDate).putLong("sms_sync_last_id",maxId).apply();
        }catch(Exception e){ toast("تعذر قراءة رسائل البنك"); }
        final boolean isFull=full;
        js("window.sanadNativeBankBulk("+JSONObject.quote(arr.toString())+","+(isFull?"true":"false")+")");
        js("window.sanadNativeBankSyncDone("+accepted+","+(isFull?"true":"false")+")");
    }

    private void drainPending(){
        if(bankDrainInProgress || web==null) return;
        bankDrainInProgress=true;
        try{
            List<SanadDatabase.PendingBank> list=db.listPending();
            if(list.isEmpty()){ bankDrainInProgress=false; return; }
            deliverPendingSequentially(list,0);
        }catch(Exception e){ bankDrainInProgress=false; }
    }
    private void deliverPendingSequentially(List<SanadDatabase.PendingBank> list,int index){
        if(index>=list.size()){ bankDrainInProgress=false; return; }
        SanadDatabase.PendingBank p=list.get(index);
        String code="(function(){if(typeof window.sanadNativeBankMessage!=='function')return false;return window.sanadNativeBankMessage("+
                JSONObject.quote(p.raw)+","+p.postedAt+","+JSONObject.quote(p.hash)+")===true;})()";
        web.evaluateJavascript(code,value->{
            boolean ok="true".equals(value);
            if(ok){ try{db.ackPending(p.hash);}catch(Exception ignored){} }
            if(!ok){ bankDrainInProgress=false; return; }
            deliverPendingSequentially(list,index+1);
        });
    }

    @Override public void onRequestPermissionsResult(int req,String[] perms,int[] grants){
        super.onRequestPermissionsResult(req,perms,grants);
        boolean granted=grants.length>0&&grants[0]==PackageManager.PERMISSION_GRANTED;
        if(req==REQ_AUDIO){
            if(granted){ if(whisperVoice!=null) whisperVoice.onPermissionGranted(); }
            else{
                toast("صلاحية الميكروفون مطلوبة للصوت");
                js("window.sanadNativeVoiceError("+JSONObject.quote("صلاحية الميكروفون مطلوبة")+")");
            }
        }else if(req==REQ_SMS){
            if(granted) startSmsSyncThread(false);
            else{
                toast("يمكنك لصق رسالة البنك يدويًا بدون صلاحية SMS");
                maybePromptNotificationAccess();
            }
        }
    }

    @Override protected void onActivityResult(int req,int res,Intent data){
        super.onActivityResult(req,res,data);
        if(res!=RESULT_OK||data==null||data.getData()==null){
            if(req==REQ_EXPORT) pendingExport=null;
            return;
        }
        if(req==REQ_EXPORT&&pendingExport!=null){
            try(OutputStream os=getContentResolver().openOutputStream(data.getData())){
                if(os==null) throw new IOException("no output stream");
                os.write(pendingExport.getBytes(StandardCharsets.UTF_8)); os.flush();
                toast("تم حفظ النسخة الاحتياطية");
            }catch(Exception e){ toast("تعذر حفظ النسخة الاحتياطية"); }
            pendingExport=null;
        }else if(req==REQ_IMPORT){
            try(InputStream is=getContentResolver().openInputStream(data.getData()); ByteArrayOutputStream out=new ByteArrayOutputStream()){
                if(is==null) throw new IOException("no input stream");
                byte[] buf=new byte[8192]; int n;
                while((n=is.read(buf))!=-1){
                    if(out.size()+n>5_000_000) throw new IOException("too large");
                    out.write(buf,0,n);
                }
                String raw=out.toString(StandardCharsets.UTF_8.name());
                js("window.sanadNativeRestore("+JSONObject.quote(raw)+")");
            }catch(Exception e){ toast("تعذر استرجاع النسخة الاحتياطية"); }
        }
    }

    private void toast(String s){ runOnUiThread(()->Toast.makeText(this,s,Toast.LENGTH_SHORT).show()); }
}
