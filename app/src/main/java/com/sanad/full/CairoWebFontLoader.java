package com.sanad.full;

import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.ProviderInfo;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.CancellationSignal;
import android.provider.FontRequest;
import android.provider.FontsContract;
import android.util.Base64;
import android.webkit.WebView;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Loads the real Cairo font from the Google Fonts provider exposed by Google Play Services,
 * then injects it into the SANAD WebView as an @font-face named "Cairo".
 *
 * The system font path itself does not use the app's INTERNET permission;
 * provider / Google Play Services handles acquisition and caching.
 */
final class CairoWebFontLoader {
    private static final String AUTHORITY="com.google.android.gms.fonts";
    private static final String PROVIDER_PACKAGE="com.google.android.gms";
    private static final Map<Integer,String> MEMORY_CACHE=Collections.synchronizedMap(new HashMap<>());
    private CairoWebFontLoader() {}

    static void load(Activity activity, WebView webView) {
        new Thread(() -> {
            try {
                String regular = fetchFontAsBase64(activity, 400);
                String semiBold = fetchFontAsBase64(activity, 600);
                String bold = fetchFontAsBase64(activity, 700);
                if (regular == null || regular.isEmpty()) return;

                StringBuilder css = new StringBuilder();
                appendFace(css, regular, 400);
                if (semiBold != null && !semiBold.isEmpty()) appendFace(css, semiBold, 600);
                if (bold != null && !bold.isEmpty()) appendFace(css, bold, 700);
                css.append("html,body,.app,.app *:not(.rawbox),button,input,textarea,select{font-family:'Cairo',Tahoma,Arial,'Segoe UI',sans-serif!important;}");

                String quoted = JSONObject.quote(css.toString());
                String js = "(function(){var old=document.getElementById('sanad-cairo-runtime');if(old)old.remove();" +
                        "var st=document.createElement('style');st.id='sanad-cairo-runtime';st.textContent=" + quoted + ";" +
                        "document.head.appendChild(st);document.fonts.load('400 16px Cairo','سند').then(function(){document.documentElement.setAttribute('data-sanad-font','cairo-loaded');document.documentElement.dataset.cairoFont=document.fonts.check('400 16px Cairo','سند')?'loaded':'fallback';}).catch(function(){document.documentElement.dataset.cairoFont='fallback';});})();";
                activity.runOnUiThread(() -> webView.evaluateJavascript(js, null));
            } catch (Throwable ignored) {
                // Existing CSS falls back gracefully if the provider is unavailable/offline on first run.
            }
        }, "sanad-cairo-loader").start();
    }

    private static void appendFace(StringBuilder css, String data, int weight) {
        css.append("@font-face{font-family:'Cairo';src:url(data:font/ttf;base64,")
           .append(data)
           .append(") format('truetype');font-style:normal;font-weight:")
           .append(weight)
           .append(";font-display:swap;}");
    }

    private static String fetchFontAsBase64(Context context, int weight) throws Exception {
        String cached=MEMORY_CACHE.get(weight);
        if(cached!=null&&!cached.isEmpty()) return cached;
        String query = "name=Cairo&weight=" + weight + "&italic=0&besteffort=true";
        ProviderInfo provider=context.getPackageManager().resolveContentProvider(AUTHORITY,0);
        if(provider==null || !PROVIDER_PACKAGE.equals(provider.packageName)) return null;
        List<List<byte[]>> certs=providerCertificates(context);
        if(certs.isEmpty()) return null;
        FontRequest request = new FontRequest(AUTHORITY, PROVIDER_PACKAGE, query, certs);
        CancellationSignal signal = new CancellationSignal();
        FontsContract.FontFamilyResult family = FontsContract.fetchFonts(context, signal, request);
        if (family == null || family.getStatusCode() != 0) return null;
        FontsContract.FontInfo[] infos = family.getFonts();
        if (infos == null || infos.length == 0) return null;

        FontsContract.FontInfo best = null;
        int bestDelta = Integer.MAX_VALUE;
        for (FontsContract.FontInfo info : infos) {
            if (info == null || info.getResultCode() != 0) continue;
            int delta = Math.abs(info.getWeight() - weight);
            if (best == null || delta < bestDelta) { best = info; bestDelta = delta; }
        }
        if (best == null) return null;

        Uri uri = best.getUri();
        try (InputStream in = context.getContentResolver().openInputStream(uri);
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (in == null) return null;
            byte[] buf = new byte[8192];
            int n;
            int limit = 3_000_000;
            while ((n = in.read(buf)) != -1) {
                if (out.size() + n > limit) return null;
                out.write(buf, 0, n);
            }
            String encoded=Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
            if(!encoded.isEmpty()) MEMORY_CACHE.put(weight,encoded);
            return encoded;
        }
    }

    private static List<List<byte[]>> providerCertificates(Context context) throws Exception {
        PackageManager pm=context.getPackageManager();
        int flags=android.os.Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;
        PackageInfo info=pm.getPackageInfo(PROVIDER_PACKAGE,flags);
        Signature[] signatures;
        if(android.os.Build.VERSION.SDK_INT>=28 && info.signingInfo!=null){
            // FontRequest verifies the provider's current signer set. Historical rotated certs must not be mixed into the same set.
            signatures=info.signingInfo.getApkContentsSigners();
        }else signatures=info.signatures;
        if(signatures==null||signatures.length==0) return Collections.emptyList();
        List<byte[]> oneSet=new ArrayList<>();
        for(Signature signature:signatures) if(signature!=null) oneSet.add(signature.toByteArray());
        if(oneSet.isEmpty()) return Collections.emptyList();
        List<List<byte[]>> outer=new ArrayList<>(); outer.add(oneSet); return outer;
    }
}
