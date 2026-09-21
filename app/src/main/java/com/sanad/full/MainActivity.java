package com.sanad.full;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.provider.Settings;
import android.text.InputType;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.Toast;

import android.window.OnBackInvokedDispatcher;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;

public class MainActivity extends Activity {
    private static MainActivity current;
    private WebView web;
    private SanadDatabase db;
    private OfflineVoiceEngine whisperVoice;
    private boolean smsImportRunning=false;
    private static final int REQ_AUDIO=401, REQ_SMS=402, REQ_EXPORT=403, REQ_IMPORT=404;
    private String pendingExport;
    private String pendingImportEncrypted;
    private int pendingSmsDays=120;
    private boolean pendingSmsForceFull=false;
    private boolean bankDrainInProgress=false;
    private AlertDialog lockDialog;
    private long backgroundAt=0L;
    private long lastUnlockAt=0L;
    private long lastBackAt=0L;

    @Override protected void onCreate(Bundle b){
        super.onCreate(b);
        current=this;
        db=new SanadDatabase(this);
        setupWeb();
        whisperVoice=new OfflineVoiceEngine(this,new OfflineVoiceEngine.Listener(){
            @Override public void onState(String state,String detail){ js("window.sanadNativeVoiceState("+JSONObject.quote(state)+","+JSONObject.quote(detail==null?"":detail)+")"); }
            @Override public void onLevel(float level){ js("window.sanadNativeVoiceLevel("+level+")"); }
            @Override public void onPartial(String text){ js("window.sanadNativeVoicePartial("+JSONObject.quote(text==null?"":text)+")"); }
            @Override public void onDone(String text){ js("window.sanadNativeVoiceDone("+JSONObject.quote(text==null?"":text)+")"); }
            @Override public void onError(String message){ js("window.sanadNativeVoiceError("+JSONObject.quote(message==null?"خطأ في الصوت":message)+")"); }
        });
        SanadReminderScheduler.ensureScheduled(this);
        if(Build.VERSION.SDK_INT>=33){
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                    this::handleSystemBack
            );
        }
    }

    @Override protected void onResume(){
        super.onResume();
        if(web!=null) runOnUiThread(this::drainPending);
        if(AppLockStore.hasPin(this) && (lastUnlockAt==0L || (backgroundAt>0L && System.currentTimeMillis()-backgroundAt>30_000L))){
            runOnUiThread(()->showUnlockIfNeeded(true));
        } else if(web!=null) web.setVisibility(View.VISIBLE);
        backgroundAt=0L;
    }

    @Override protected void onPause(){
        backgroundAt=System.currentTimeMillis();
        if(whisperVoice!=null && whisperVoice.isRecording()){
            try{ whisperVoice.stop(); }catch(Exception ignored){}
        }
        super.onPause();
    }

    @Override protected void onDestroy(){
        if(current==this) current=null;
        if(whisperVoice!=null){ try{whisperVoice.release();}catch(Exception ignored){} }
        if(lockDialog!=null){ try{lockDialog.dismiss();}catch(Exception ignored){} lockDialog=null; }
        if(web!=null){ try{web.removeJavascriptInterface("Android"); web.destroy();}catch(Exception ignored){} }
        super.onDestroy();
    }

    private void setupWeb(){
        web=new WebView(this);
        web.setVisibility(AppLockStore.hasPin(this)?View.INVISIBLE:View.VISIBLE);
        setContentView(web);
        WebSettings s=web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setBlockNetworkLoads(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.setWebViewClient(new WebViewClient(){
            @Override public void onPageFinished(WebView view,String url){
                super.onPageFinished(view,url);
                CairoWebFontLoader.load(MainActivity.this,web);
                injectV27Fixes();
                injectAssetJs("v28_runtime.js");
                injectAssetJs("v35_voice.js");
                drainPending();
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(),"Android");
        web.loadUrl("file:///android_asset/index.html");
    }

    private void js(String code){ runOnUiThread(()->{ if(web!=null) web.evaluateJavascript(code,null); }); }

    public static void requestPendingBankDrainIfOpen(){ MainActivity a=current; if(a!=null) a.runOnUiThread(a::drainPending); }

    public final class Bridge {
        @JavascriptInterface public boolean saveState(String json){
            try{ db.saveState(json); SanadReminderScheduler.ensureScheduled(MainActivity.this); return true; }
            catch(Exception e){ toast("تعذر حفظ البيانات المشفرة"); return false; }
        }
        @JavascriptInterface public String loadState(){
            try{ String state=db.loadState(); return state==null?"":state; }
            catch(Exception e){ toast("تعذر قراءة البيانات المشفرة"); return ""; }
        }
        @JavascriptInterface public boolean clearState(){
            try{
                db.clearState();
                try{CryptoStore.deleteKey();}catch(Exception ignored){}
                getSharedPreferences("sanad_prefs",MODE_PRIVATE).edit().clear().apply();
                getSharedPreferences("sanad_reminder_state",MODE_PRIVATE).edit().clear().apply();
                AppLockStore.clear(MainActivity.this);
                return true;
            }catch(Exception e){ toast("تعذر حذف البيانات المحلية"); return false; }
        }
        @JavascriptInterface public void prepareVoice(){ runOnUiThread(()->{ if(whisperVoice!=null) whisperVoice.prepare(); }); }
        @JavascriptInterface public String voiceStatus(){ return whisperVoice==null?"unavailable":whisperVoice.status(); }
        @JavascriptInterface public String runtimeDiagnostics(){
            try{
                JSONObject o=new JSONObject();
                o.put("version","3.5-whisper-only");
                o.put("audioPermission",checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED);
                o.put("smsPermission",checkSelfPermission(Manifest.permission.READ_SMS)==PackageManager.PERMISSION_GRANTED);
                o.put("voiceStatus",whisperVoice==null?"unavailable":whisperVoice.status());
                o.put("voiceDetails",whisperVoice==null?"unavailable":whisperVoice.diagnostics());
                o.put("sdk",Build.VERSION.SDK_INT);
                o.put("manufacturer",Build.MANUFACTURER);
                o.put("model",Build.MODEL);
                return o.toString();
            }catch(Exception e){return "{}";}
        }
        @JavascriptInterface public void startVoice(String locale){ runOnUiThread(()->{ if(whisperVoice!=null) whisperVoice.start(locale); }); }
        @JavascriptInterface public void stopVoice(){ runOnUiThread(()->{ if(whisperVoice!=null) whisperVoice.stop(); }); }
        @JavascriptInterface public void openAppSettings(){ runOnUiThread(()->{
            Intent i=new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getPackageName()));
            startActivity(i);
        }); }
        @JavascriptInterface public void importBankSms(int days){
            pendingSmsDays=days<=0?0:Math.max(1,Math.min(days,3650));
            runOnUiThread(()->beginSmsSync(false));
        }
        @JavascriptInterface public void refreshBankSms(){ runOnUiThread(()->beginSmsSync(false)); }
        @JavascriptInterface public void fullResyncBankSms(){ runOnUiThread(()->beginSmsSync(true)); }
        @JavascriptInterface public void drainPendingBankMessages(){ runOnUiThread(MainActivity.this::drainPending); }
        @JavascriptInterface public void ensureBankCaptureAccess(){ runOnUiThread(()->{ if(!notificationAccessEnabled()) startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)); }); }
        @JavascriptInterface public void openNotificationAccess(){ runOnUiThread(()->startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))); }
        @JavascriptInterface public void ensureAppNotifications(){ runOnUiThread(()->SanadReminderScheduler.requestPermissionIfNeeded(MainActivity.this)); }
        @JavascriptInterface public boolean hasAppPin(){ return AppLockStore.hasPin(MainActivity.this); }
        @JavascriptInterface public boolean setAppPin(String pin){ return AppLockStore.setPin(MainActivity.this,pin); }
        @JavascriptInterface public boolean removeAppPin(String pin){ if(!AppLockStore.verify(MainActivity.this,pin)) return false; AppLockStore.clear(MainActivity.this); return true; }
        @JavascriptInterface public void lockNow(){ runOnUiThread(()->showUnlockIfNeeded(true)); }
        @JavascriptInterface public void exportBackup(String json){ runOnUiThread(()->promptBackupPasswordAndExport(json)); }
        @JavascriptInterface public void importBackup(){
            runOnUiThread(()->{
                Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                startActivityForResult(i,REQ_IMPORT);
            });
        }
    }

    private void showUnlockIfNeeded(boolean force){
        if(!AppLockStore.hasPin(this)){ if(web!=null) web.setVisibility(View.VISIBLE); return; }
        if(!force && web!=null && web.getVisibility()==View.VISIBLE) return;
        if(lockDialog!=null && lockDialog.isShowing()) return;
        if(web!=null) web.setVisibility(View.INVISIBLE);
        final EditText input=new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        input.setHint("PIN");
        input.setMaxLines(1);
        int pad=(int)(20*getResources().getDisplayMetrics().density);
        input.setPadding(pad,pad/2,pad,pad/2);
        AlertDialog d=new AlertDialog.Builder(this)
                .setTitle("فتح سند")
                .setMessage("أدخل رمز PIN")
                .setView(input)
                .setCancelable(false)
                .setNegativeButton("إغلاق التطبيق",(x,w)->finish())
                .setPositiveButton("فتح",null)
                .create();
        d.setOnShowListener(x->{
            d.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
                if(AppLockStore.verify(MainActivity.this,input.getText().toString())){
                    lastUnlockAt=System.currentTimeMillis();
                    if(web!=null) web.setVisibility(View.VISIBLE);
                    d.dismiss(); lockDialog=null;
                }else{ input.setError("PIN غير صحيح"); input.selectAll(); }
            });
        });
        d.setOnDismissListener(x->{ if(lockDialog==d) lockDialog=null; });
        lockDialog=d; d.show();
    }

    private void maybePromptNotificationAccess(){
        if(notificationAccessEnabled()) return;
        android.content.SharedPreferences prefs=getSharedPreferences("sanad_prefs",MODE_PRIVATE);
        long now=System.currentTimeMillis(),last=prefs.getLong("notif_prompt_last",0L);
        if(last>0&&now-last<3L*24L*60L*60L*1000L) return;
        AlertDialog dialog=new AlertDialog.Builder(this)
                .setTitle("التقاط معاملات البنك الجديدة")
                .setMessage("لتسجيل إشعارات معاملات البنك الجديدة تلقائيًا على الجهاز، فعّل وصول الإشعارات لسند. لا يتم إرسال الرسائل لأي خادم.")
                .setNegativeButton("لاحقًا",(d,w)->prefs.edit().putLong("notif_prompt_last",System.currentTimeMillis()).apply())
                .setPositiveButton("فتح الإعدادات",(d,w)->{ prefs.edit().putLong("notif_prompt_last",System.currentTimeMillis()).apply(); startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)); })
                .create();
        dialog.setOnCancelListener(d->prefs.edit().putLong("notif_prompt_last",System.currentTimeMillis()).apply());
        dialog.show();
    }

    private boolean notificationAccessEnabled(){
        String flat=Settings.Secure.getString(getContentResolver(),"enabled_notification_listeners");
        if(flat==null||flat.trim().isEmpty()) return false;
        for(String part:flat.split(":")){
            ComponentName cn=ComponentName.unflattenFromString(part);
            if(cn!=null&&getPackageName().equals(cn.getPackageName())) return true;
        }
        return false;
    }

    private void beginSmsSync(boolean forceFull){
        pendingSmsForceFull=forceFull;
        if(checkSelfPermission(Manifest.permission.READ_SMS)!=PackageManager.PERMISSION_GRANTED){ requestPermissions(new String[]{Manifest.permission.READ_SMS},REQ_SMS); return; }
        if(smsImportRunning) return;
        startSmsSyncThread(forceFull);
    }

    private void startSmsSyncThread(boolean forceFull){
        smsImportRunning=true;
        new Thread(()->{
            try{syncSms(forceFull);}finally{smsImportRunning=false;runOnUiThread(this::maybePromptNotificationAccess);}
        },"sanad-sms-sync").start();
    }

    private static long normalizeSmsEpoch(long value){
        if(value<=0L) return 0L;
        if(value<100_000_000_000L) value*=1000L;
        long min=946_684_800_000L;
        long max=System.currentTimeMillis()+2L*24L*60L*60L*1000L;
        return (value>=min&&value<=max)?value:0L;
    }

    private static long bestSmsEventTime(long received,long sent){
        long r=normalizeSmsEpoch(received), s=normalizeSmsEpoch(sent);
        if(s>0L && (r<=0L || Math.abs(r-s)<=45L*24L*60L*60L*1000L)) return s;
        return r>0L?r:System.currentTimeMillis();
    }

    private void syncSms(boolean forceFull){
        JSONArray arr=new JSONArray();
        android.content.SharedPreferences prefs=getSharedPreferences("sanad_prefs",MODE_PRIVATE);
        boolean initialized=prefs.getBoolean("sms_sync_initialized",false);
        boolean full=forceFull||!initialized;
        long lastDate=prefs.getLong("sms_sync_last_date",0L);
        long now=System.currentTimeMillis();
        long after;
        if(full) after=pendingSmsDays<=0?0L:Math.max(0L,now-(long)pendingSmsDays*86_400_000L);
        else after=Math.max(0L,lastDate-5L*60L*1000L);
        HashSet<String> batch=new HashSet<>(); int accepted=0; long maxDate=lastDate; long maxId=prefs.getLong("sms_sync_last_id",0L);
        boolean queryOk=false;
        String[] projection=new String[]{"_id","address","body","date","date_sent"};
        try(Cursor cur=getContentResolver().query(Uri.parse("content://sms/inbox"),projection,null,null,"date DESC")){
            if(cur!=null){
                while(cur.moveToNext()){
                    long smsId=cur.getLong(0); String sender=cur.getString(1); String body=cur.getString(2);
                    long received=normalizeSmsEpoch(cur.getLong(3)), sent=normalizeSmsEpoch(cur.getLong(4));
                    if(after>0L && received>0L && received<after) break;
                    long eventAt=bestSmsEventTime(received,sent);
                    if(received>maxDate){maxDate=received;maxId=smsId;}
                    BankSmsParser.Result parsed=BankSmsParser.parse(body,eventAt);
                    if(parsed==null) continue;
                    String h=BankMessageFilter.messageFingerprint(body,eventAt,smsId,sender); if(!batch.add(h)) continue;
                    JSONObject o=new JSONObject();
                    o.put("sender",sender==null?"":sender); o.put("text",body);
                    o.put("date",eventAt); o.put("receivedAt",received); o.put("sentAt",sent); o.put("hash",h);
                    o.put("parsedAmount",parsed.amount); o.put("parsedCurrency",parsed.currency);
                    o.put("parsedType",parsed.type); o.put("parsedDate",parsed.transactionAt);
                    o.put("parsedConfidence",parsed.confidence); o.put("parsedAmountSource",parsed.amountSource);
                    arr.put(o); accepted++;
                    if(accepted>=5000) break;
                }
                queryOk=true;
            }
            if(queryOk) prefs.edit().putBoolean("sms_sync_initialized",true).putLong("sms_sync_last_date",maxDate).putLong("sms_sync_last_id",maxId).apply();
        }catch(Exception e){toast("تعذر قراءة رسائل البنك");}
        js("window.sanadNativeBankBulk("+JSONObject.quote(arr.toString())+","+(full?"true":"false")+")");
        js("window.sanadNativeBankSyncDone("+accepted+","+(full?"true":"false")+")");
    }

    private void drainPending(){
        if(bankDrainInProgress||web==null) return;
        bankDrainInProgress=true;
        try{
            List<SanadDatabase.PendingBank> list=db.listPending();
            if(list.isEmpty()){bankDrainInProgress=false;return;}
            deliverPendingSequentially(list,0);
        }catch(Exception e){bankDrainInProgress=false;}
    }

    private void deliverPendingSequentially(List<SanadDatabase.PendingBank> list,int index){
        if(index>=list.size()){bankDrainInProgress=false;return;}
        SanadDatabase.PendingBank p=list.get(index);
        String code="(function(){if(typeof window.sanadNativeBankMessage!=='function')return false;return window.sanadNativeBankMessage("+JSONObject.quote(p.raw)+","+p.postedAt+","+JSONObject.quote(p.hash)+")===true;})()";
        web.evaluateJavascript(code,value->{
            boolean ok="true".equals(value);
            if(ok){try{db.ackPending(p.hash);}catch(Exception ignored){}}
            if(!ok){bankDrainInProgress=false;return;}
            deliverPendingSequentially(list,index+1);
        });
    }

    @Override public void onRequestPermissionsResult(int req,String[] perms,int[] grants){
        super.onRequestPermissionsResult(req,perms,grants);
        boolean granted=grants.length>0&&grants[0]==PackageManager.PERMISSION_GRANTED;
        if(req==REQ_AUDIO){
            if(granted){if(whisperVoice!=null) whisperVoice.onPermissionGranted();}
            else{
                boolean blocked=Build.VERSION.SDK_INT>=23 && !shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO);
                if(whisperVoice!=null) whisperVoice.onPermissionDenied(blocked);
                if(blocked) showMicPermissionHelp();
            }
        }else if(req==REQ_SMS){
            if(granted) startSmsSyncThread(pendingSmsForceFull);
            else{toast("يمكنك لصق رسالة البنك يدويًا بدون صلاحية SMS");maybePromptNotificationAccess();}
        }else if(req==SanadReminderScheduler.REQ_NOTIFICATIONS && !granted){
            toast("يمكنك استخدام سند بدون تنبيهات النظام");
        }
    }

    @Override protected void onActivityResult(int req,int res,Intent data){
        super.onActivityResult(req,res,data);
        if(res!=RESULT_OK||data==null||data.getData()==null){if(req==REQ_EXPORT)pendingExport=null;return;}
        if(req==REQ_EXPORT&&pendingExport!=null){
            try(OutputStream os=getContentResolver().openOutputStream(data.getData())){
                if(os==null)throw new IOException("no output stream");
                os.write(pendingExport.getBytes(StandardCharsets.UTF_8));os.flush();toast("تم حفظ النسخة الاحتياطية المشفرة");
            }catch(Exception e){toast("تعذر حفظ النسخة الاحتياطية");}
            pendingExport=null;
        }else if(req==REQ_IMPORT){
            try(InputStream is=getContentResolver().openInputStream(data.getData());ByteArrayOutputStream out=new ByteArrayOutputStream()){
                if(is==null)throw new IOException("no input stream"); byte[] buf=new byte[8192];int n;
                while((n=is.read(buf))!=-1){if(out.size()+n>8_000_000)throw new IOException("too large");out.write(buf,0,n);}
                String raw=out.toString(StandardCharsets.UTF_8.name());
                if(BackupCrypto.isEncrypted(raw)){ pendingImportEncrypted=raw; runOnUiThread(this::promptBackupPasswordAndImport); }
                else js("window.sanadNativeRestore("+JSONObject.quote(raw)+")");
            }catch(Exception e){toast("تعذر استرجاع النسخة الاحتياطية");}
        }
    }

    private void promptBackupPasswordAndExport(String json){
        final EditText input=new EditText(this); input.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD); input.setHint("6 أحرف أو أكثر");
        AlertDialog d=new AlertDialog.Builder(this).setTitle("تشفير النسخة الاحتياطية").setMessage("اكتب كلمة مرور. ستحتاجها عند الاسترجاع، ولا يمكن لسند استعادتها إذا نسيتها.").setView(input).setNegativeButton("إلغاء",null).setPositiveButton("متابعة",null).create();
        d.setOnShowListener(x->d.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
            String pass=input.getText().toString(); if(pass.length()<6){input.setError("6 أحرف على الأقل");return;}
            try{ pendingExport=BackupCrypto.encrypt(json,pass); d.dismiss(); Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT); i.addCategory(Intent.CATEGORY_OPENABLE); i.setType("application/octet-stream"); i.putExtra(Intent.EXTRA_TITLE,"sanad-backup-"+LocalDate.now()+".sanad"); startActivityForResult(i,REQ_EXPORT); }
            catch(Exception e){toast("تعذر تشفير النسخة الاحتياطية");}
        })); d.show();
    }

    private void promptBackupPasswordAndImport(){
        if(pendingImportEncrypted==null)return;
        final EditText input=new EditText(this); input.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD); input.setHint("كلمة مرور النسخة");
        AlertDialog d=new AlertDialog.Builder(this).setTitle("فتح نسخة سند").setView(input).setNegativeButton("إلغاء",(x,w)->pendingImportEncrypted=null).setPositiveButton("فتح",null).create();
        d.setOnShowListener(x->d.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
            try{ String plain=BackupCrypto.decrypt(pendingImportEncrypted,input.getText().toString()); pendingImportEncrypted=null; d.dismiss(); js("window.sanadNativeRestore("+JSONObject.quote(plain)+")"); }
            catch(Exception e){input.setError("كلمة المرور غير صحيحة أو الملف تالف");input.selectAll();}
        })); d.show();
    }

    private void handleSystemBack(){
        if(lockDialog!=null && lockDialog.isShowing()) return;
        if(web==null){ moveTaskToBack(true); return; }
        final String code="(function(){try{if(typeof window.sanadHandleBack==='function')return window.sanadHandleBack()===true;if(typeof window.sanadHandleAndroidBack==='function')return window.sanadHandleAndroidBack()===true;if(typeof UI!=='undefined'&&UI.stack&&UI.stack.length>1&&typeof back==='function'){back();return true;}}catch(e){}return false;})()";
        web.evaluateJavascript(code,value->{
            if("true".equals(value)) return;
            long now=System.currentTimeMillis();
            if(now-lastBackAt<1800L){ moveTaskToBack(true); lastBackAt=0L; }
            else{ lastBackAt=now; toast("اضغط رجوع مرة أخرى للخروج"); }
        });
    }

    @Override public boolean onKeyDown(int keyCode,android.view.KeyEvent event){
        if(keyCode==android.view.KeyEvent.KEYCODE_BACK && event.getAction()==android.view.KeyEvent.ACTION_DOWN){ handleSystemBack(); return true; }
        return super.onKeyDown(keyCode,event);
    }

    @Override public void onBackPressed(){ handleSystemBack(); }

    private void injectV27Fixes(){
        try(InputStream is=getAssets().open("v27_fixes.js");ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] buf=new byte[8192]; int n;
            while((n=is.read(buf))!=-1) out.write(buf,0,n);
            String code=new String(out.toByteArray(),StandardCharsets.UTF_8);
            web.evaluateJavascript(code,null);
        }catch(Exception e){
            android.util.Log.e("SANAD","Failed to inject V2.7 fixes",e);
        }
    }

    private void injectAssetJs(String assetName){
        try(InputStream is=getAssets().open(assetName);ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] buf=new byte[8192]; int n;
            while((n=is.read(buf))!=-1) out.write(buf,0,n);
            web.evaluateJavascript(new String(out.toByteArray(),StandardCharsets.UTF_8),null);
        }catch(Exception e){ android.util.Log.e("SANAD","Failed to inject "+assetName,e); }
    }

    private void showMicPermissionHelp(){
        new AlertDialog.Builder(this)
                .setTitle("تفعيل الميكروفون")
                .setMessage("صلاحية الميكروفون مقفولة لسند. افتح إعدادات التطبيق وفعّل Microphone ثم ارجع لسند.")
                .setNegativeButton("إلغاء",null)
                .setPositiveButton("فتح الإعدادات",(d,w)->{
                    Intent i=new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getPackageName()));
                    startActivity(i);
                }).show();
    }

    private void toast(String s){runOnUiThread(()->Toast.makeText(this,s,Toast.LENGTH_SHORT).show());}
}
