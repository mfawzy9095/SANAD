package com.sanad.v9test;

import android.app.Activity;
import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.Manifest;
import android.content.pm.PackageManager;
import org.json.JSONObject;
import android.os.Build;
import android.os.CancellationSignal;
import android.os.OperationCanceledException;
import android.hardware.biometrics.BiometricPrompt;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.database.Cursor;
import android.os.Bundle;
import android.provider.MediaStore;
import android.provider.Settings;
import android.provider.Telephony;
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
import androidx.core.app.NotificationManagerCompat;
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
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final int REQ_FILE_CHOOSER = 7001;
    private static final int REQ_CREATE_DOCUMENT = 7002;
    private static final int REQ_NOTIFICATION_PERMISSION = 7003;
    private static final int REQ_DEVICE_AUTH = 7004;
    private static final int REQ_READ_SMS = 7005;
    private static final String APP_URL = "https://appassets.androidplatform.net/assets/index.html";

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraOutputUri;
    private String pendingDownloadName;
    private byte[] pendingDownloadBytes;
    private long backgroundedAtMs = 0L;
    private boolean authInProgress = false;
    private final ExecutorService historicalSmsExecutor = Executors.newSingleThreadExecutor();
    private final ExecutorService bankNotificationExecutor = Executors.newSingleThreadExecutor();
    private final Object historicalSmsLock = new Object();
    private CancellationSignal historicalSmsCancellation;
    private String historicalSmsRequestId;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        cleanupOldCameraFiles();
        NotificationScheduler.ensureChannel(this);

        WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(244, 255, 253));
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
        if (requestCode == REQ_DEVICE_AUTH) {
            authInProgress = false;
            notifyJsDeviceAuthResult(resultCode == RESULT_OK);
            return;
        }
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
        public boolean notificationsGranted() {
            return Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
                    notifyJsPermissionResult(true);
                    return;
                }
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFICATION_PERMISSION);
            });
        }

        @JavascriptInterface
        public void syncNotifications(String json) {
            runOnUiThread(() -> NotificationScheduler.scheduleAll(MainActivity.this, json));
        }

        @JavascriptInterface
        public void cancelNotifications() {
            runOnUiThread(() -> NotificationScheduler.cancelAll(MainActivity.this));
        }

        @JavascriptInterface
        public void showNotification(String id, String title, String body) {
            runOnUiThread(() -> NotificationScheduler.showNow(MainActivity.this, id, title, body));
        }

        @JavascriptInterface
        public boolean bankNotificationAccessEnabled() {
            return NotificationManagerCompat.getEnabledListenerPackages(MainActivity.this)
                    .contains(getPackageName());
        }

        @JavascriptInterface
        public void openBankNotificationAccessSettings() {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
                } catch (ActivityNotFoundException e) {
                    try {
                        startActivity(new Intent(Settings.ACTION_SETTINGS));
                    } catch (ActivityNotFoundException ignored) {
                        Toast.makeText(MainActivity.this, "Could not open notification access settings", Toast.LENGTH_LONG).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public String getPendingBankNotifications() {
            return BankNotificationStore.getAllJson(MainActivity.this);
        }

        @JavascriptInterface
        public void startRescanActiveBankNotifications(String requestId) {
            String safeRequestId = requestId == null ? "" : requestId.trim();
            if (safeRequestId.isEmpty() || safeRequestId.length() > 80) {
                notifyJsBankRescanResult(safeRequestId, -2);
                return;
            }
            try {
                bankNotificationExecutor.execute(() -> {
                    int added = BankNotificationListener.rescanActiveNow();
                    if (added < 0) BankNotificationListener.requestReconnect(MainActivity.this);
                    notifyJsBankRescanResult(safeRequestId, added);
                });
            } catch (Exception ignored) {
                notifyJsBankRescanResult(safeRequestId, -2);
            }
        }

        @JavascriptInterface
        public String getBankNotificationDiagnostics() {
            try {
                JSONObject out = new JSONObject(BankNotificationStore.getDiagnosticsJson(MainActivity.this));
                out.put("accessEnabled", bankNotificationAccessEnabled());
                out.put("listenerConnected", BankNotificationListener.isConnected());
                out.put("historicalSmsPermission", historicalSmsPermissionGranted());
                return out.toString();
            } catch (Exception ignored) {
                return "{}";
            }
        }

        @JavascriptInterface
        public boolean historicalSmsPermissionGranted() {
            return checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public void requestHistoricalSmsPermission() {
            runOnUiThread(() -> {
                if (historicalSmsPermissionGranted()) {
                    notifyJsHistoricalSmsPermissionResult(true);
                    return;
                }
                requestPermissions(new String[]{Manifest.permission.READ_SMS}, REQ_READ_SMS);
            });
        }

        @JavascriptInterface
        public void startHistoricalFinancialSmsPage(
                String requestId, int days, long afterDate, long afterId, int rawLimit) {
            String safeRequestId = requestId == null ? "" : requestId.trim();
            if (safeRequestId.isEmpty() || safeRequestId.length() > 80) {
                JSONObject error = new JSONObject();
                try {
                    error.put("ok", false);
                    error.put("status", "invalid-request");
                } catch (Exception ignored) {}
                notifyJsHistoricalSmsPageResult(safeRequestId, error);
                return;
            }

            CancellationSignal signal = new CancellationSignal();
            synchronized (historicalSmsLock) {
                if (historicalSmsCancellation != null) {
                    try { historicalSmsCancellation.cancel(); } catch (Exception ignored) {}
                }
                historicalSmsCancellation = signal;
                historicalSmsRequestId = safeRequestId;
            }

            try {
                historicalSmsExecutor.execute(() -> {
                    JSONObject result = importHistoricalFinancialSmsPageInternal(
                            days, afterDate, afterId, rawLimit, signal);
                    synchronized (historicalSmsLock) {
                        if (historicalSmsCancellation == signal) {
                            historicalSmsCancellation = null;
                            historicalSmsRequestId = null;
                        }
                    }
                    notifyJsHistoricalSmsPageResult(safeRequestId, result);
                });
            } catch (Exception error) {
                synchronized (historicalSmsLock) {
                    if (historicalSmsCancellation == signal) {
                        historicalSmsCancellation = null;
                        historicalSmsRequestId = null;
                    }
                }
                JSONObject out = new JSONObject();
                try {
                    out.put("ok", false);
                    out.put("status", "worker-unavailable");
                } catch (Exception ignored) {}
                notifyJsHistoricalSmsPageResult(safeRequestId, out);
            }
        }

        @JavascriptInterface
        public void cancelHistoricalSmsImport() {
            CancellationSignal signal;
            synchronized (historicalSmsLock) {
                signal = historicalSmsCancellation;
                historicalSmsCancellation = null;
                historicalSmsRequestId = null;
            }
            if (signal != null) {
                try { signal.cancel(); } catch (Exception ignored) {}
            }
        }

        @JavascriptInterface
        public void acknowledgeBankNotifications(String jsonIds) {
            BankNotificationStore.acknowledge(MainActivity.this, jsonIds);
        }

        @JavascriptInterface
        public boolean clearBankNotifications() {
            return BankNotificationStore.clear(MainActivity.this);
        }

        @JavascriptInterface
        public boolean supportsDeviceAuth() {
            KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
            return km != null && km.isDeviceSecure();
        }

        @JavascriptInterface
        public void authenticateDevice(String reason) {
            runOnUiThread(() -> startDeviceAuthentication(reason));
        }

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

    private JSONObject importHistoricalFinancialSmsPageInternal(
            int days, long afterDate, long afterId, int rawLimit, CancellationSignal cancellationSignal) {
        JSONObject out = new JSONObject();
        try {
            if (checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
                out.put("ok", false);
                out.put("status", "permission-required");
                return out;
            }

            int safeDays = Math.max(0, Math.min(days, 3650));
            // The provider query runs on a dedicated worker thread. Keep each page small
            // so cancellation and progress callbacks remain fast even on very large inboxes.
            int safeLimit = Math.max(10, Math.min(rawLimit, 40));
            long cutoff = safeDays > 0
                    ? System.currentTimeMillis() - (long) safeDays * 24L * 60L * 60L * 1000L
                    : 0L;
            long cursorDate = Math.max(0L, afterDate);
            long cursorId = Math.max(0L, afterId);

            String[] projection = new String[]{
                    Telephony.Sms._ID,
                    Telephony.Sms.ADDRESS,
                    Telephony.Sms.BODY,
                    Telephony.Sms.DATE
            };

            String selection;
            String[] selectionArgs;
            if (cutoff > 0L) {
                selection = Telephony.Sms.DATE + ">=? AND (" +
                        Telephony.Sms.DATE + ">? OR (" +
                        Telephony.Sms.DATE + "=? AND " + Telephony.Sms._ID + ">?))";
                selectionArgs = new String[]{
                        String.valueOf(cutoff),
                        String.valueOf(cursorDate),
                        String.valueOf(cursorDate),
                        String.valueOf(cursorId)
                };
            } else {
                selection = Telephony.Sms.DATE + ">? OR (" +
                        Telephony.Sms.DATE + "=? AND " + Telephony.Sms._ID + ">?)";
                selectionArgs = new String[]{
                        String.valueOf(cursorDate),
                        String.valueOf(cursorDate),
                        String.valueOf(cursorId)
                };
            }

            int scanned = 0;
            int candidates = 0;
            int added = 0;
            int matchingRows = 0;
            long nextDate = cursorDate;
            long nextId = cursorId;
            boolean hasMore = false;
            boolean capacityReached = false;

            try (Cursor cursor = getContentResolver().query(
                    Telephony.Sms.Inbox.CONTENT_URI,
                    projection,
                    selection,
                    selectionArgs,
                    Telephony.Sms.DATE + " ASC, " + Telephony.Sms._ID + " ASC",
                    cancellationSignal)) {
                if (cursor == null) throw new IllegalStateException("sms-query-unavailable");
                {
                    int idCol = cursor.getColumnIndex(Telephony.Sms._ID);
                    int addressCol = cursor.getColumnIndex(Telephony.Sms.ADDRESS);
                    int bodyCol = cursor.getColumnIndex(Telephony.Sms.BODY);
                    int dateCol = cursor.getColumnIndex(Telephony.Sms.DATE);
                    if (idCol < 0 || addressCol < 0 || bodyCol < 0 || dateCol < 0) {
                        throw new IllegalStateException("sms-columns-unavailable");
                    }

                    while (scanned < safeLimit && cursor.moveToNext()) {
                        if (cancellationSignal != null) cancellationSignal.throwIfCanceled();
                        scanned++;
                        matchingRows++;
                        long smsId = idCol >= 0 ? cursor.getLong(idCol) : 0L;
                        String address = addressCol >= 0 ? cursor.getString(addressCol) : "";
                        String body = bodyCol >= 0 ? cursor.getString(bodyCol) : "";
                        long at = dateCol >= 0 ? cursor.getLong(dateCol) : 0L;
                        long previousDate = nextDate;
                        long previousId = nextId;
                        nextDate = Math.max(0L, at);
                        nextId = Math.max(0L, smsId);

                        if (body == null || body.trim().isEmpty()) continue;
                        String safeAddress = address == null ? "" : address.trim();
                        String probe = (safeAddress + " " + body).trim();
                        if (!BankNotificationFilter.looksLikeCandidate(probe)) continue;

                        candidates++;
                        int enqueueStatus = BankNotificationStore.enqueueStatus(
                                MainActivity.this,
                                "sms:" + safeAddress,
                                safeAddress,
                                body,
                                at > 0L ? at : System.currentTimeMillis());
                        if (enqueueStatus == BankNotificationStore.FULL) {
                            nextDate = previousDate;
                            nextId = previousId;
                            capacityReached = true;
                            hasMore = true;
                            break;
                        }
                        if (enqueueStatus == BankNotificationStore.ERROR) throw new IllegalStateException("inbox-write-failed");
                        if (enqueueStatus == BankNotificationStore.ADDED) added++;
                    }
                    if (!capacityReached && scanned >= safeLimit) {
                        if (cancellationSignal != null) cancellationSignal.throwIfCanceled();
                        hasMore = cursor.moveToNext();
                    }
                }
            }

            out.put("ok", true);
            out.put("status", "complete");
            out.put("days", safeDays);
            out.put("scanned", scanned);
            out.put("matchingRows", matchingRows);
            out.put("financialCandidates", candidates);
            out.put("addedToInbox", added);
            out.put("nextAfterDate", nextDate);
            out.put("nextAfterId", nextId);
            out.put("done", !hasMore);
            out.put("capacityReached", capacityReached);
            return out;
        } catch (OperationCanceledException cancelled) {
            try {
                out.put("ok", false);
                out.put("status", "cancelled");
            } catch (Exception ignored) {}
            return out;
        } catch (SecurityException denied) {
            try {
                out.put("ok", false);
                out.put("status", "permission-restricted");
                out.put("message", "READ_SMS is restricted by Android or the installer");
            } catch (Exception ignored) {}
            return out;
        } catch (Exception error) {
            try {
                out.put("ok", false);
                out.put("status", "query-failed");
                out.put("message", error.getClass().getSimpleName());
            } catch (Exception ignored) {}
            return out;
        }
    }

    private void notifyJsBankRescanResult(String requestId, int added) {
        final String safeId = requestId == null ? "" : requestId;
        runOnUiThread(() -> {
            if (webView == null || isFinishing() || isDestroyed()) return;
            webView.evaluateJavascript(
                    "window.sanadBankRescanResult&&window.sanadBankRescanResult(" +
                            JSONObject.quote(safeId) + "," + added + ");",
                    null
            );
        });
    }

    private void notifyJsHistoricalSmsPageResult(String requestId, JSONObject result) {
        final String safeId = requestId == null ? "" : requestId;
        final String payload = result == null ? "{}" : result.toString();
        runOnUiThread(() -> {
            if (webView == null || isFinishing() || isDestroyed()) return;
            webView.evaluateJavascript(
                    "window.sanadHistoricalSmsPageResult&&window.sanadHistoricalSmsPageResult(" +
                            JSONObject.quote(safeId) + "," + payload + ");",
                    null
            );
        });
    }

    private void notifyJsHistoricalSmsPermissionResult(boolean allowed) {
        if (webView == null) return;
        webView.evaluateJavascript(
                "window.sanadHistoricalSmsPermissionResult&&window.sanadHistoricalSmsPermissionResult(" + (allowed ? "true" : "false") + ");",
                null
        );
    }

    private void notifyJsPermissionResult(boolean allowed) {
        if (webView == null) return;
        webView.evaluateJavascript("window.sanadNotificationPermissionResult&&window.sanadNotificationPermissionResult(" + (allowed ? "true" : "false") + ");", null);
    }

    private void notifyJsDeviceAuthResult(boolean allowed) {
        if (webView == null) return;
        webView.evaluateJavascript("window.sanadDeviceAuthResult&&window.sanadDeviceAuthResult(" + (allowed ? "true" : "false") + ");", null);
    }

    private void startDeviceAuthentication(String reason) {
        KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        if (km == null || !km.isDeviceSecure()) {
            notifyJsDeviceAuthResult(false);
            return;
        }
        String subtitle = (reason == null || reason.trim().isEmpty()) ? "Verify to open SANAD" : reason;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                BiometricPrompt.Builder builder = new BiometricPrompt.Builder(this)
                        .setTitle("SANAD — سند")
                        .setSubtitle(subtitle);
                builder.setAllowedAuthenticators(
                        android.hardware.biometrics.BiometricManager.Authenticators.BIOMETRIC_STRONG |
                        android.hardware.biometrics.BiometricManager.Authenticators.DEVICE_CREDENTIAL);
                BiometricPrompt prompt = builder.build();
                CancellationSignal signal = new CancellationSignal();
                authInProgress = true;
                prompt.authenticate(signal, getMainExecutor(), new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        authInProgress = false;
                        notifyJsDeviceAuthResult(true);
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, CharSequence errString) {
                        authInProgress = false;
                        notifyJsDeviceAuthResult(false);
                    }
                });
                return;
            } catch (Exception ignored) {
                authInProgress = false;
            }
        }
        Intent confirm = km.createConfirmDeviceCredentialIntent("SANAD — سند", subtitle);
        if (confirm == null) {
            notifyJsDeviceAuthResult(false);
            return;
        }
        try {
            authInProgress = true;
            startActivityForResult(confirm, REQ_DEVICE_AUTH);
        } catch (ActivityNotFoundException e) {
            authInProgress = false;
            notifyJsDeviceAuthResult(false);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_NOTIFICATION_PERMISSION) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            notifyJsPermissionResult(granted);
            return;
        }
        if (requestCode == REQ_READ_SMS) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            notifyJsHistoricalSmsPermissionResult(granted);
        }
    }

    private void notifyJsAppBackgrounded(long atMs) {
        if (webView == null) return;
        webView.evaluateJavascript(
                "window.sanadAppBackgrounded&&window.sanadAppBackgrounded(" + atMs + ");",
                null
        );
    }

    private void notifyJsAppForegrounded(long atMs) {
        if (webView == null) return;
        webView.evaluateJavascript(
                "window.sanadAppForegrounded&&window.sanadAppForegrounded(" + atMs + ");",
                null
        );
    }

    @Override
    protected void onStop() {
        if (!authInProgress) {
            backgroundedAtMs = System.currentTimeMillis();
            notifyJsAppBackgrounded(backgroundedAtMs);
        }
        super.onStop();
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (!authInProgress && backgroundedAtMs > 0L) {
            long now = System.currentTimeMillis();
            notifyJsAppForegrounded(now);
            backgroundedAtMs = 0L;
        }
    }

    @Override
    public void onBackPressed() {
        webView.evaluateJavascript(
                "(function(){try{if(typeof sanadHandleBack==='function'&&sanadHandleBack())return 'handled';}catch(e){}return 'none';})()",
                result -> {
                    if (result != null && result.contains("handled")) return;
                    if (webView.canGoBack()) webView.goBack();
                    else MainActivity.super.onBackPressed();
                }
        );
    }

    @Override
    protected void onDestroy() {
        cancelOutstandingChooser();
        synchronized (historicalSmsLock) {
            if (historicalSmsCancellation != null) {
                try { historicalSmsCancellation.cancel(); } catch (Exception ignored) {}
                historicalSmsCancellation = null;
                historicalSmsRequestId = null;
            }
        }
        historicalSmsExecutor.shutdownNow();
        bankNotificationExecutor.shutdownNow();
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
