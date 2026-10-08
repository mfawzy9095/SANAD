package com.sanad.v9test;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import java.lang.ref.WeakReference;

/** User-started local import only. Financial durability remains in the verified app store.
 * Not sticky: process death resumes from the durable application checkpoint, never a timer.
 */
public final class SmsImportService extends Service {
    private static final String CHANNEL = "sanad_sms_import";
    private static final int NOTIFICATION = 92013;
    static final String PAUSE = "com.sanad.v9test.IMPORT_PAUSE";
    static final String CANCEL = "com.sanad.v9test.IMPORT_CANCEL";
    interface Control { void stop(String reason); }
    private static volatile WeakReference<Control> control = new WeakReference<>(null);
    private static volatile WeakReference<SmsImportService> active = new WeakReference<>(null);
    private PowerManager.WakeLock wakeLock;
    private long scanned, added, review, total = -1;
    static void attach(Control owner) { control = new WeakReference<>(owner); }
    static boolean running() { return active.get() != null; }
    static void progress(long scanned, long added, long review, long total) {
        SmsImportService service = active.get();
        if (service != null) service.update(scanned, added, review, total);
    }
    @Override public void onCreate() {
        super.onCreate();
        getSystemService(NotificationManager.class).createNotificationChannel(
                new NotificationChannel(CHANNEL, "استيراد رسائل SANAD", NotificationManager.IMPORTANCE_LOW));
        PowerManager power = getSystemService(PowerManager.class);
        wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, getPackageName() + ":SmsImport");
        wakeLock.setReferenceCounted(false);
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (PAUSE.equals(action) || CANCEL.equals(action)) {
            requestStop(CANCEL.equals(action) ? "user" : "pause");return START_NOT_STICKY;
        }
        if (control.get() == null) { stopSelf();return START_NOT_STICKY; }
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        else startForeground(NOTIFICATION, notification());
        active = new WeakReference<>(this);
        renewWakeLock();
        return START_NOT_STICKY;
    }
    private PendingIntent action(String action, int code) {
        return PendingIntent.getService(this, code, new Intent(this, SmsImportService.class).setAction(action),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private Notification notification() {
        PendingIntent open = PendingIntent.getActivity(this, 0,
                new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL).setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("SANAD · قراءة الرسائل محليًا")
                .setContentText("قُرئ " + scanned + " · أُضيف " + added + " · للمراجعة " + review)
                .setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true)
                .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setProgress(total > 0 ? (int)Math.min(Integer.MAX_VALUE, total) : 0,
                        (int)Math.min(Integer.MAX_VALUE, scanned), total < 0)
                .addAction(0, "إيقاف مؤقت", action(PAUSE, 1))
                .addAction(0, "إلغاء", action(CANCEL, 2)).build();
    }
    private void update(long scanned, long added, long review, long total) {
        this.scanned = Math.max(0, scanned);this.added = Math.max(0, added);
        this.review = Math.max(0, review);this.total = total;
        getSystemService(NotificationManager.class).notify(NOTIFICATION, notification());
        renewWakeLock();
    }
    private void renewWakeLock() {
        if (wakeLock.isHeld()) wakeLock.release();
        wakeLock.acquire(10 * 60 * 1000L); // Bounded lease; renewed only after actual durable progress.
    }
    private void requestStop(String reason) {
        Control owner = control.get();if (owner != null) owner.stop(reason);
        stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();
    }
    @Override public void onTimeout(int startId, int fgsType) { requestStop("pause"); }
    @Override public void onTaskRemoved(Intent rootIntent) { requestStop("pause");super.onTaskRemoved(rootIntent); }
    @Override public void onDestroy() {
        if (active.get() == this) active = new WeakReference<>(null);
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
