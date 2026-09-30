package com.sanad.v9test;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import android.view.ViewGroup;

import androidx.annotation.Nullable;
import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewFeature;
import androidx.webkit.WebSettingsCompat;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import android.util.Base64;
import java.util.List;

public final class MainActivity extends Activity {
    private static final int REQ_FILE_CHOOSER = 7001;
    private static final int REQ_CREATE_DOCUMENT = 7002;
    private static final String APP_URL = "https://appassets.androidplatform.net/assets/index.html";

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraOutputUri;
    private String pendingDownloadName;
    private byte[] pendingDownloadBytes;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        cleanupOldCameraFiles();

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(246, 249, 248));
        setContentView(webView);

        final WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);

        if (WebViewFeature.isFeatureSupported(WebViewFeature.SAFE_BROWSING_ENABLE)) {
            WebSettingsCompat.setSafeBrowsingEnabled(settings, true);
        }

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                final Uri uri = request.getUrl();
                WebResourceResponse local = assetLoader.shouldInterceptRequest(uri);
                return local != null ? local : super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("appassets.androidplatform.net".equalsIgnoreCase(uri.getHost())) {
                    return false;
                }
                String scheme = uri.getScheme();
                if ("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme)) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (ActivityNotFoundException ignored) {
                        Toast.makeText(MainActivity.this, "No browser available", Toast.LENGTH_SHORT).show();
                    }
                    return true;
                }
                return true;
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                try {
                    if (view.getParent() instanceof ViewGroup) {
                        ((ViewGroup) view.getParent()).removeView(view);
                    }
                    view.destroy();
                } catch (Exception ignored) {}
                Toast.makeText(MainActivity.this, "SANAD restarted after a WebView failure", Toast.LENGTH_LONG).show();
                recreate();
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                injectAndroidDownloadHook();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams params) {
                cancelOutstandingChooser();
                fileCallback = callback;
                if (isImageChooser(params)) {
                    launchImageChooser();
                } else {
                    launchDocumentChooser(params);
                }
                return true;
            }
        });

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        webView.loadUrl(APP_URL);
    }

    private void injectAndroidDownloadHook() {
        final String js = "(function(){" +
                "if(window.__sanadAndroidDownloadHook)return;window.__sanadAndroidDownloadHook=true;" +
                "document.addEventListener('click',async function(e){" +
                "var a=e.target&&e.target.closest?e.target.closest('a[download]'):null;" +
                "if(!a||!a.href||!a.href.startsWith('blob:'))return;" +
                "e.preventDefault();e.stopPropagation();" +
                "try{var r=await fetch(a.href);var b=await r.blob();var fr=new FileReader();" +
                "fr.onloadend=function(){AndroidBridge.saveDataUrl(String(a.download||'sanad-export.json'),String(fr.result||''));};" +
                "fr.readAsDataURL(b);}catch(err){AndroidBridge.toast('Export failed');}" +
                "},true);})();";
        webView.evaluateJavascript(js, null);
    }

    private void cleanupOldCameraFiles() {
        File dir = new File(getCacheDir(), "camera");
        File[] files = dir.listFiles();
        if (files == null) return;
        long cutoff = System.currentTimeMillis() - 24L * 60L * 60L * 1000L;
        for (File file : files) {
            if (file.isFile() && file.lastModified() < cutoff) {
                // Best-effort cache cleanup only.
                //noinspection ResultOfMethodCallIgnored
                file.delete();
            }
        }
    }

    private boolean isImageChooser(WebChromeClient.FileChooserParams params) {
        if (params == null) return false;
        String[] types = params.getAcceptTypes();
        if (types == null || types.length == 0) return false;
        for (String raw : types) {
            if (raw == null) continue;
            for (String part : raw.split(",")) {
                String t = part.trim().toLowerCase();
                if (t.startsWith("image/") || t.equals("image/*") ||
                        t.endsWith(".jpg") || t.endsWith(".jpeg") || t.endsWith(".png") ||
                        t.endsWith(".webp") || t.endsWith(".heic") || t.endsWith(".heif")) {
                    return true;
                }
            }
        }
        return false;
    }

    private void launchDocumentChooser(WebChromeClient.FileChooserParams params) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false);

        String mime = "application/json";
        List<String> mimeTypes = new ArrayList<>();
        if (params != null && params.getAcceptTypes() != null) {
            for (String raw : params.getAcceptTypes()) {
                if (raw == null) continue;
                for (String part : raw.split(",")) {
                    String t = part.trim();
                    if (t.contains("/") && !t.startsWith(".")) mimeTypes.add(t);
                }
            }
        }
        if (mimeTypes.size() == 1) {
            mime = mimeTypes.get(0);
        } else if (mimeTypes.size() > 1) {
            mime = "*/*";
            intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes.toArray(new String[0]));
        }
        intent.setType(mime);

        try {
            startActivityForResult(intent, REQ_FILE_CHOOSER);
        } catch (ActivityNotFoundException e) {
            cancelOutstandingChooser();
            Toast.makeText(this, "No file picker available", Toast.LENGTH_LONG).show();
        }
    }

    private void launchImageChooser() {
        Intent content = new Intent(Intent.ACTION_GET_CONTENT);
        content.addCategory(Intent.CATEGORY_OPENABLE);
        content.setType("image/*");
        content.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false);

        List<Intent> initial = new ArrayList<>();
        Intent camera = createCameraIntent();
        if (camera != null) initial.add(camera);

        Intent chooser = new Intent(Intent.ACTION_CHOOSER);
        chooser.putExtra(Intent.EXTRA_INTENT, content);
        chooser.putExtra(Intent.EXTRA_TITLE, "Receipt image");
        if (!initial.isEmpty()) {
            chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, initial.toArray(new Intent[0]));
        }
        startActivityForResult(chooser, REQ_FILE_CHOOSER);
    }

    private Intent createCameraIntent() {
        Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (camera.resolveActivity(getPackageManager()) == null) return null;
        try {
            File dir = new File(getCacheDir(), "camera");
            if (!dir.exists() && !dir.mkdirs()) return null;
            File image = File.createTempFile("sanad_receipt_", ".jpg", dir);
            cameraOutputUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", image);
            camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraOutputUri);
            camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            return camera;
        } catch (Exception e) {
            cameraOutputUri = null;
            return null;
        }
    }

    private void cancelOutstandingChooser() {
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE_CHOOSER) {
            if (fileCallback == null) return;
            Uri[] result = null;
            if (resultCode == RESULT_OK) {
                if (data != null && data.getClipData() != null) {
                    ClipData clip = data.getClipData();
                    result = new Uri[clip.getItemCount()];
                    for (int i = 0; i < clip.getItemCount(); i++) result[i] = clip.getItemAt(i).getUri();
                } else if (data != null && data.getData() != null) {
                    result = new Uri[]{data.getData()};
                } else if (cameraOutputUri != null) {
                    result = new Uri[]{cameraOutputUri};
                }
            }
            fileCallback.onReceiveValue(result);
            fileCallback = null;
            cameraOutputUri = null;
            return;
        }
        if (requestCode == REQ_CREATE_DOCUMENT) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingDownloadBytes != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                    if (out == null) throw new IllegalStateException("No output stream");
                    out.write(pendingDownloadBytes);
                    out.flush();
                    Toast.makeText(this, "Backup saved", Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    Toast.makeText(this, "Could not save backup", Toast.LENGTH_LONG).show();
                }
            }
            pendingDownloadBytes = null;
            pendingDownloadName = null;
        }
    }

    private void startSaveDocument(String fileName, byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            Toast.makeText(this, "Nothing to export", Toast.LENGTH_SHORT).show();
            return;
        }
        pendingDownloadName = sanitizeFileName(fileName);
        pendingDownloadBytes = bytes;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeForName(pendingDownloadName));
        intent.putExtra(Intent.EXTRA_TITLE, pendingDownloadName);
        startActivityForResult(intent, REQ_CREATE_DOCUMENT);
    }

    private String sanitizeFileName(String name) {
        String clean = name == null ? "sanad-export.json" : name.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        if (clean.isEmpty()) clean = "sanad-export.json";
        return clean.length() > 120 ? clean.substring(clean.length() - 120) : clean;
    }

    private String mimeForName(String fileName) {
        String ext = MimeTypeMap.getFileExtensionFromUrl(fileName);
        String type = ext == null ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext.toLowerCase());
        return type != null ? type : "application/json";
    }

    private byte[] decodeDataUrl(String dataUrl) {
        if (dataUrl == null) return null;
        int comma = dataUrl.indexOf(',');
        if (comma < 0) return null;
        String head = dataUrl.substring(0, comma);
        String body = dataUrl.substring(comma + 1);
        try {
            if (head.contains(";base64")) {
                return Base64.decode(body, Base64.DEFAULT);
            }
            return Uri.decode(body).getBytes(StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    public final class AndroidBridge {
        @JavascriptInterface
        public void saveDataUrl(String fileName, String dataUrl) {
            byte[] bytes = decodeDataUrl(dataUrl);
            runOnUiThread(() -> startSaveDocument(fileName, bytes));
        }

        @JavascriptInterface
        public void toast(String message) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show());
        }
    }

    @Override
    public void onBackPressed() {
        webView.evaluateJavascript(
                "(function(){var w=document.getElementById('sheetWrap');if(w&&w.classList.contains('show')){if(typeof closeSheet==='function')closeSheet();return 'closed';}return 'none';})()",
                result -> {
                    if (result != null && result.contains("closed")) return;
                    if (webView.canGoBack()) webView.goBack();
                    else MainActivity.super.onBackPressed();
                }
        );
    }

    @Override
    protected void onDestroy() {
        cancelOutstandingChooser();
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidBridge");
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
        }
        super.onDestroy();
    }
}
