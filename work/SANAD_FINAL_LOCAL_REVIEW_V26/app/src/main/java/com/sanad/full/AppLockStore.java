package com.sanad.full;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

public final class AppLockStore {
    private static final String PREF = "sanad_lock";
    private static final String K_SALT = "salt";
    private static final String K_HASH = "hash";
    private static final int ITERATIONS = 120_000;
    private static final int KEY_BITS = 256;

    private AppLockStore() {}

    public static boolean hasPin(Context c) {
        SharedPreferences p = c.getSharedPreferences(PREF, Context.MODE_PRIVATE);
        return p.contains(K_SALT) && p.contains(K_HASH);
    }

    public static boolean setPin(Context c, String pin) {
        if (pin == null || !pin.matches("\\d{4,8}")) return false;
        try {
            byte[] salt = new byte[16];
            new SecureRandom().nextBytes(salt);
            byte[] hash = derive(pin, salt);
            c.getSharedPreferences(PREF, Context.MODE_PRIVATE).edit()
                    .putString(K_SALT, Base64.encodeToString(salt, Base64.NO_WRAP))
                    .putString(K_HASH, Base64.encodeToString(hash, Base64.NO_WRAP))
                    .apply();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public static boolean verify(Context c, String pin) {
        if (pin == null) return false;
        SharedPreferences p = c.getSharedPreferences(PREF, Context.MODE_PRIVATE);
        String saltB64 = p.getString(K_SALT, null);
        String hashB64 = p.getString(K_HASH, null);
        if (saltB64 == null || hashB64 == null) return false;
        try {
            byte[] salt = Base64.decode(saltB64, Base64.NO_WRAP);
            byte[] expected = Base64.decode(hashB64, Base64.NO_WRAP);
            byte[] actual = derive(pin, salt);
            return MessageDigest.isEqual(expected, actual);
        } catch (Exception e) {
            return false;
        }
    }

    public static void clear(Context c) {
        c.getSharedPreferences(PREF, Context.MODE_PRIVATE).edit().clear().apply();
    }

    private static byte[] derive(String pin, byte[] salt) throws Exception {
        PBEKeySpec spec = new PBEKeySpec(pin.toCharArray(), salt, ITERATIONS, KEY_BITS);
        try {
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        } finally {
            spec.clearPassword();
        }
    }
}
