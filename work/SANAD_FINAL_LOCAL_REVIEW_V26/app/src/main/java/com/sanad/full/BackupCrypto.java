package com.sanad.full;

import android.util.Base64;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

public final class BackupCrypto {
    private static final int ITERATIONS = 150000;
    private static final SecureRandom RNG = new SecureRandom();
    private BackupCrypto() {}

    public static String encrypt(String plain, String password) throws Exception {
        if (password == null || password.length() < 6) throw new IllegalArgumentException("password");
        byte[] salt = new byte[16], iv = new byte[12]; RNG.nextBytes(salt); RNG.nextBytes(iv);
        SecretKeySpec key = derive(password, salt);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
        byte[] enc = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
        JSONObject o = new JSONObject();
        o.put("app", "sanad-backup"); o.put("version", 1); o.put("kdf", "PBKDF2-HMAC-SHA256");
        o.put("iterations", ITERATIONS); o.put("cipher", "AES-256-GCM");
        o.put("salt", b64(salt)); o.put("iv", b64(iv)); o.put("data", b64(enc));
        return o.toString();
    }

    public static boolean isEncrypted(String raw) {
        try { JSONObject o = new JSONObject(raw); return "sanad-backup".equals(o.optString("app")) && o.has("data") && o.has("salt") && o.has("iv"); }
        catch (Exception e) { return false; }
    }

    public static String decrypt(String raw, String password) throws Exception {
        JSONObject o = new JSONObject(raw);
        int iterations = o.optInt("iterations", ITERATIONS);
        if (iterations < 50000 || iterations > 1000000) throw new IllegalArgumentException("iterations");
        byte[] salt = b64d(o.getString("salt")), iv = b64d(o.getString("iv")), data = b64d(o.getString("data"));
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, iterations, 256);
        byte[] kb = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded(); spec.clearPassword();
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(kb, "AES"), new GCMParameterSpec(128, iv));
        return new String(c.doFinal(data), StandardCharsets.UTF_8);
    }

    private static SecretKeySpec derive(String password, byte[] salt) throws Exception {
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, ITERATIONS, 256);
        byte[] kb = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded(); spec.clearPassword();
        return new SecretKeySpec(kb, "AES");
    }
    private static String b64(byte[] x){ return Base64.encodeToString(x, Base64.NO_WRAP); }
    private static byte[] b64d(String x){ return Base64.decode(x, Base64.NO_WRAP); }
}
