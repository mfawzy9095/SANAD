package com.sanad.offline;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.*;
import android.speech.*;
import android.view.*;
import android.view.inputmethod.InputMethodManager;
import android.widget.*;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.*;
import java.util.*;

public class MainActivity extends Activity {
    private static final int REQ_AUDIO = 40, REQ_EXPORT = 41;
    private final int TEAL = Color.rgb(14,107,98), BG = Color.rgb(247,244,239), INK = Color.rgb(18,42,51), MUTED = Color.rgb(92,110,119);
    private DatabaseHelper db;
    private SharedPreferences prefs;
    private LinearLayout root, txList;
    private EditText input, askInput;
    private TextView safeValue, monthValue, dailyValue, voiceStatus, answer;
    private Button undoButton;
    private long lastInsertedId = -1;
    private SpeechRecognizer recognizer;

    @Override public void onCreate(Bundle b) {
        super.onCreate(b);
        db = new DatabaseHelper(this);
        prefs = getSharedPreferences("sanad", MODE_PRIVATE);
        buildUi();
        refresh();
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this); scroll.setFillViewport(true); scroll.setBackgroundColor(BG);
        root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(dp(18),dp(20),dp(18),dp(40));
        scroll.addView(root); setContentView(scroll);

        TextView title = text("سند",30,Typeface.BOLD,INK); root.addView(title);
        TextView sub = text("مساعدك المالي المحلي — يعمل بدون حساب وبدون سيرفر",13,Typeface.NORMAL,MUTED); margin(sub,0,2,0,16); root.addView(sub);

        LinearLayout safe = card();
        safe.addView(text("المتاح الآمن للصرف",13,Typeface.BOLD,Color.WHITE));
        safeValue = text("—",32,Typeface.BOLD,Color.WHITE); margin(safeValue,0,5,0,0); safe.addView(safeValue);
        LinearLayout row = hrow();
        LinearLayout a=column(); a.addView(text("مصروف الشهر",11,Typeface.NORMAL,0xCCFFFFFF)); monthValue=text("—",16,Typeface.BOLD,Color.WHITE);a.addView(monthValue);
        LinearLayout d=column(); d.addView(text("المتاح / يوم",11,Typeface.NORMAL,0xCCFFFFFF)); dailyValue=text("—",16,Typeface.BOLD,Color.WHITE);d.addView(dailyValue);
        row.addView(a,new LinearLayout.LayoutParams(0,-2,1));row.addView(d,new LinearLayout.LayoutParams(0,-2,1));margin(row,0,16,0,0);safe.addView(row);
        root.addView(safe);

        Button budget = button("تحديد / تعديل الميزانية الشهرية", false); budget.setOnClickListener(v->budgetDialog()); margin(budget,0,10,0,18); root.addView(budget);

        root.addView(section("إضافة مصروف"));
        input = new EditText(this); input.setHint("مثال: نون آيس كريم خمسين درهم"); input.setTextSize(17); input.setMinHeight(dp(74)); input.setPadding(dp(14),dp(12),dp(14),dp(12)); input.setBackground(round(Color.WHITE,0xFFE2DBD0,16)); root.addView(input,new LinearLayout.LayoutParams(-1,-2));
        LinearLayout actions=hrow(); Button parse=button("حلّل وأضف",true);Button mic=button("🎙 صوت Offline",false);actions.addView(parse,new LinearLayout.LayoutParams(0,dp(52),1));LinearLayout.LayoutParams mlp=new LinearLayout.LayoutParams(0,dp(52),1);mlp.setMarginStart(dp(8));actions.addView(mic,mlp);margin(actions,0,10,0,0);root.addView(actions);
        parse.setOnClickListener(v->handleInput(input.getText().toString(),"text")); mic.setOnClickListener(v->startOfflineVoice());
        voiceStatus=text("الصوت: فحص المحرك المحلي عند الطلب",12,Typeface.NORMAL,MUTED);root.addView(voiceStatus);
        undoButton=button("تراجع عن آخر إضافة",false);undoButton.setVisibility(View.GONE);undoButton.setOnClickListener(v->{if(lastInsertedId>0){db.delete(lastInsertedId);lastInsertedId=-1;undoButton.setVisibility(View.GONE);refresh();}});margin(undoButton,0,8,0,18);root.addView(undoButton);

        root.addView(section("اسأل سند — محلي"));
        askInput=new EditText(this);askInput.setHint("مثال: صرفت كام على نون الشهر ده؟");askInput.setSingleLine(true);askInput.setBackground(round(Color.WHITE,0xFFE2DBD0,16));askInput.setPadding(dp(14),0,dp(14),0);root.addView(askInput,new LinearLayout.LayoutParams(-1,dp(52)));
        Button ask=button("اسأل",true);ask.setOnClickListener(v->answerLocal(askInput.getText().toString()));margin(ask,0,8,0,8);root.addView(ask);
        answer=text("",14,Typeface.NORMAL,INK);answer.setPadding(dp(14),dp(12),dp(14),dp(12));answer.setBackground(round(0xFFF0F7F5,0xFFE1EFEC,16));answer.setVisibility(View.GONE);root.addView(answer);

        root.addView(section("آخر العمليات")); txList=column();root.addView(txList);

        root.addView(section("الخصوصية والاعتمادية"));
        Button notif=button("تفعيل قراءة إشعارات البنك",false);notif.setOnClickListener(v->startActivity(new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")));root.addView(notif);
        Button export=button("نسخة احتياطية JSON",false);export.setOnClickListener(v->exportBackup());margin(export,0,8,0,0);root.addView(export);
        TextView privacy=text("SANAD لا يطلب صلاحية الإنترنت أصلًا. البيانات والحسابات محفوظة داخل الهاتف. إشعارات البنك لا تُقرأ إلا بعد منح Notification Access يدويًا.",12,Typeface.NORMAL,MUTED);privacy.setLineSpacing(0,1.35f);margin(privacy,0,10,0,0);root.addView(privacy);
    }

    private void handleInput(String raw, String source) {
        hideKeyboard(); if(raw==null||raw.trim().isEmpty()){toast("اكتب أو قل العملية أولًا");return;}
        Transaction tx=FinanceParser.parse(raw,source);
        if(!tx.hasAmount()){showReview(tx,true);return;}
        if(tx.confidence>=0.92){saveTx(tx);return;}
        showReview(tx,false);
    }

    private void showReview(Transaction tx, boolean missingAmount) {
        LinearLayout box=column();box.setPadding(dp(16),0,dp(16),0);
        EditText amount=new EditText(this);amount.setInputType(android.text.InputType.TYPE_CLASS_NUMBER|android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);amount.setHint("المبلغ");if(tx.amount>0)amount.setText(fmt(tx.amount));box.addView(amount);
        EditText merchant=new EditText(this);merchant.setHint("التاجر (اختياري)");merchant.setText(tx.merchant);box.addView(merchant);
        EditText note=new EditText(this);note.setHint("ملاحظة");note.setText(tx.note);box.addView(note);
        new AlertDialog.Builder(this).setTitle(missingAmount?"سند مش متأكد من المبلغ":"مراجعة سريعة")
                .setMessage("العملة: "+tx.currency+"   •   الفئة: "+arCat(tx.category)+"\nالثقة: "+Math.round(tx.confidence*100)+"%")
                .setView(box).setNegativeButton("إلغاء",null).setPositiveButton("حفظ",(d,w)->{try{tx.amount=Double.parseDouble(amount.getText().toString().replace(',','.'));}catch(Exception e){toast("المبلغ غير صحيح");return;}tx.merchant=merchant.getText().toString().trim();tx.note=note.getText().toString().trim();saveTx(tx);}).show();
    }

    private void saveTx(Transaction tx){if(db.isDuplicate(tx,5*60*1000L)){toast("العملية موجودة بالفعل — لم تتم إضافتها مرة ثانية");return;}lastInsertedId=db.insert(tx);undoButton.setVisibility(View.VISIBLE);input.setText("");toast("تمت الإضافة ✓  "+fmt(tx.amount)+" "+tx.currency);refresh();}

    private void startOfflineVoice(){
        if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},REQ_AUDIO);return;}
        if(Build.VERSION.SDK_INT<31 || !SpeechRecognizer.isOnDeviceRecognitionAvailable(this)){voiceStatus.setText("الصوت المحلي غير متاح على هذا الجهاز. لن أستخدم الإنترنت. استخدم الكتابة أو ثبّت حزمة العربية Offline في إعدادات الهاتف.");return;}
        try{
            if(recognizer!=null) recognizer.destroy();
            recognizer=SpeechRecognizer.createOnDeviceSpeechRecognizer(this);
            recognizer.setRecognitionListener(new RecognitionListener(){
                public void onReadyForSpeech(Bundle b){voiceStatus.setText("اتكلم الآن…");}
                public void onBeginningOfSpeech(){voiceStatus.setText("بسمعك…");}
                public void onRmsChanged(float r){} public void onBufferReceived(byte[] b){} public void onEndOfSpeech(){voiceStatus.setText("بفهم الجملة محليًا…");}
                public void onError(int e){voiceStatus.setText(voiceError(e));}
                public void onResults(Bundle b){ArrayList<String> r=b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);if(r!=null&&!r.isEmpty()){String best=chooseBest(r);input.setText(best);voiceStatus.setText("سمعت: "+best);handleInput(best,"voice-offline");}else voiceStatus.setText("ماسمعتش جملة واضحة");}
                public void onPartialResults(Bundle b){ArrayList<String> r=b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);if(r!=null&&!r.isEmpty()){input.setText(r.get(0));input.setSelection(input.length());}}
                public void onEvent(int e,Bundle b){}
            });
            Intent i=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);i.putExtra(RecognizerIntent.EXTRA_LANGUAGE,"ar-EG");i.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,true);i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,true);i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,5);recognizer.startListening(i);
        }catch(Exception e){voiceStatus.setText("تعذر تشغيل الصوت المحلي: "+e.getClass().getSimpleName());}
    }

    private String chooseBest(ArrayList<String> rs){String best=rs.get(0);double score=-1;for(String s:rs){Transaction t=FinanceParser.parse(s,"voice-offline");double sc=t.confidence+(t.amount>0?.3:0)+(!t.merchant.isEmpty()?.1:0);if(sc>score){score=sc;best=s;}}return best;}
    private String voiceError(int e){if(e==SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE||e==SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED)return "العربية Offline غير مثبّتة على الجهاز. لن أستخدم الإنترنت.";if(e==SpeechRecognizer.ERROR_NO_MATCH)return "مافهمتش الجملة كويس — حاول جملة أقصر.";if(e==SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS)return "صلاحية الميكروفون مرفوضة.";return "مشكلة في الصوت المحلي ("+e+") — لن أستخدم الإنترنت.";}

    private void answerLocal(String q){String x=FinanceParser.norm(q);String out;if(x.isEmpty())return;double budget=prefs.getFloat("monthly_budget",0);double spent=db.monthSpend();double safe=Math.max(0,budget-spent);int daysLeft=daysLeftInMonth();if(x.contains("اقدر اصرف")||x.contains("متاح")||x.contains("safe")){out=budget<=0?"حدد ميزانية شهرية الأول، وبعدها أحسب المتاح الآمن بدقة.":"المتاح الآمن حاليًا "+fmt(safe)+" AED، تقريبًا "+fmt(safe/Math.max(1,daysLeft))+" AED يوميًا حتى نهاية الشهر.";}else if(x.contains("صرف")&&x.contains("شهر")){out="مصروفك هذا الشهر "+fmt(spent)+" AED.";}else if(x.contains("اكتر")||x.contains("اكثر")){out="أعلى فئة صرف هذا الشهر: "+arCat(db.topCategoryThisMonth())+".";}else {String m=guessMerchant(q);if(m!=null)out="صرفك على "+m+" هذا الشهر: "+fmt(db.spendForMerchantThisMonth(m))+" AED.";else out="أقدر أجاوب محليًا عن: مصروف الشهر، المتاح الآمن، أعلى فئة، أو صرفك على تاجر محدد.";}answer.setText(out);answer.setVisibility(View.VISIBLE);}

    private String guessMerchant(String q){Transaction t=FinanceParser.parse(q,"query");if(!t.merchant.isEmpty())return t.merchant;String n=q.trim();int p=n.indexOf("على ");if(p>=0){String s=n.substring(p+4).replace("؟","").trim();if(!s.isEmpty())return s;}return null;}

    private void refresh(){double spent=db.monthSpend();float budget=prefs.getFloat("monthly_budget",0);double safe=budget>0?Math.max(0,budget-spent):0;monthValue.setText(fmt(spent)+" AED");safeValue.setText(budget>0?fmt(safe)+" AED":"حدد ميزانيتك");dailyValue.setText(budget>0?fmt(safe/Math.max(1,daysLeftInMonth()))+" AED":"—");txList.removeAllViews();List<Transaction> items=db.latest(12);if(items.isEmpty()){TextView e=text("لسه مفيش عمليات. جرّب: «نون آيس كريم خمسين درهم»",13,Typeface.NORMAL,MUTED);e.setPadding(0,dp(8),0,dp(8));txList.addView(e);}for(Transaction t:items){LinearLayout r=hrow();r.setPadding(dp(12),dp(11),dp(12),dp(11));r.setBackground(round(Color.WHITE,0xFFEDE7DD,14));TextView l=text((t.merchant.isEmpty()?arCat(t.category):t.merchant)+"\n"+shortDate(t.txTime)+" · "+arCat(t.category),13,Typeface.BOLD,INK);TextView v=text((t.income?"+":"−")+fmt(t.amount)+" "+t.currency,14,Typeface.BOLD,t.income?0xFF3E9A6D:INK);r.addView(l,new LinearLayout.LayoutParams(0,-2,1));r.addView(v);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.setMargins(0,0,0,dp(7));txList.addView(r,lp);}}

    private void budgetDialog(){EditText e=new EditText(this);e.setInputType(android.text.InputType.TYPE_CLASS_NUMBER|android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);float b=prefs.getFloat("monthly_budget",0);if(b>0)e.setText(fmt(b));e.setHint("مثال: 4000");e.setPadding(dp(18),0,dp(18),0);new AlertDialog.Builder(this).setTitle("الميزانية الشهرية").setMessage("مفيش رقم افتراضي. اكتب رقمك أنت.").setView(e).setNegativeButton("إلغاء",null).setPositiveButton("حفظ",(d,w)->{try{float v=Float.parseFloat(e.getText().toString());prefs.edit().putFloat("monthly_budget",v).apply();refresh();}catch(Exception ex){toast("الرقم غير صحيح");}}).show();}

    private void exportBackup(){Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.setType("application/json");i.putExtra(Intent.EXTRA_TITLE,"sanad-backup-"+new SimpleDateFormat("yyyy-MM-dd",Locale.US).format(new Date())+".json");startActivityForResult(i,REQ_EXPORT);}
    @Override protected void onActivityResult(int req,int res,Intent data){super.onActivityResult(req,res,data);if(req==REQ_EXPORT&&res==RESULT_OK&&data!=null){Uri u=data.getData();try(OutputStream o=getContentResolver().openOutputStream(u)){String s="{\"version\":1,\"monthlyBudget\":"+prefs.getFloat("monthly_budget",0)+",\"transactions\":"+db.exportJson().toString()+"}";o.write(s.getBytes(StandardCharsets.UTF_8));toast("تم حفظ النسخة الاحتياطية");}catch(Exception e){toast("تعذر حفظ النسخة");}}}
    @Override public void onRequestPermissionsResult(int req,String[] p,int[] g){super.onRequestPermissionsResult(req,p,g);if(req==REQ_AUDIO&&g.length>0&&g[0]==PackageManager.PERMISSION_GRANTED)startOfflineVoice();}
    @Override protected void onDestroy(){if(recognizer!=null)recognizer.destroy();db.close();super.onDestroy();}

    private LinearLayout card(){LinearLayout l=column();l.setPadding(dp(18),dp(18),dp(18),dp(18));GradientDrawable g=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{0xFF12857A,0xFF0A4F49});g.setCornerRadius(dp(22));l.setBackground(g);return l;}
    private LinearLayout column(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);return l;}private LinearLayout hrow(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.HORIZONTAL);l.setGravity(Gravity.CENTER_VERTICAL);return l;}
    private TextView section(String s){TextView v=text(s,16,Typeface.BOLD,INK);margin(v,0,20,0,9);return v;}
    private TextView text(String s,int size,int style,int color){TextView v=new TextView(this);v.setText(s);v.setTextSize(size);v.setTextColor(color);v.setTypeface(Typeface.create("sans",style));v.setGravity(Gravity.START);return v;}
    private Button button(String s,boolean primary){Button b=new Button(this);b.setText(s);b.setTextSize(14);b.setAllCaps(false);b.setTextColor(primary?Color.WHITE:TEAL);b.setBackground(round(primary?TEAL:Color.WHITE,primary?TEAL:0xFFE2DBD0,14));return b;}
    private GradientDrawable round(int fill,int stroke,int r){GradientDrawable g=new GradientDrawable();g.setColor(fill);g.setCornerRadius(dp(r));g.setStroke(dp(1),stroke);return g;}
    private void margin(View v,int l,int t,int r,int b){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.setMargins(dp(l),dp(t),dp(r),dp(b));v.setLayoutParams(p);}private int dp(int x){return (int)(x*getResources().getDisplayMetrics().density+.5f);}
    private void toast(String s){Toast.makeText(this,s,Toast.LENGTH_SHORT).show();}private void hideKeyboard(){View v=getCurrentFocus();if(v!=null)((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(v.getWindowToken(),0);}
    private String fmt(double n){return new DecimalFormat("#,##0.##").format(n);}private String shortDate(long t){return new SimpleDateFormat("dd MMM HH:mm",new Locale("ar")).format(new Date(t));}
    private int daysLeftInMonth(){Calendar c=Calendar.getInstance();return c.getActualMaximum(Calendar.DAY_OF_MONTH)-c.get(Calendar.DAY_OF_MONTH)+1;}
    private String arCat(String c){if(c==null)return"أخرى";switch(c){case"food":return"طعام";case"groceries":return"بقالة";case"transport":return"مواصلات";case"shopping":return"تسوق";case"bills":return"فواتير";case"health":return"صحة";case"subscriptions":return"اشتراكات";case"entertainment":return"ترفيه";case"home":return"المنزل";case"income":return"دخل";default:return"أخرى";}}
}
