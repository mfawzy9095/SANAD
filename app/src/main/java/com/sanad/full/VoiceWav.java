package com.sanad.full;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Converts the recorder's mono signed 16-bit PCM to a standard WAV upload. */
public final class VoiceWav {
    private VoiceWav() {}

    public static byte[] encode(byte[] pcm, int sampleRate) throws IOException {
        if (pcm == null || pcm.length == 0 || (pcm.length & 1) != 0 || sampleRate <= 0 ||
                pcm.length > 60L * sampleRate * 2)
            throw new IllegalArgumentException("invalid PCM recording");
        ByteArrayOutputStream out = new ByteArrayOutputStream(44 + pcm.length);
        out.write("RIFF".getBytes(StandardCharsets.US_ASCII));
        little32(out, 36 + pcm.length);
        out.write("WAVEfmt ".getBytes(StandardCharsets.US_ASCII));
        little32(out, 16);
        little16(out, 1);
        little16(out, 1);
        little32(out, sampleRate);
        little32(out, sampleRate * 2);
        little16(out, 2);
        little16(out, 16);
        out.write("data".getBytes(StandardCharsets.US_ASCII));
        little32(out, pcm.length);
        out.write(pcm);
        return out.toByteArray();
    }

    private static void little16(OutputStream out, int value) throws IOException {
        out.write(value & 255); out.write((value >> 8) & 255);
    }
    private static void little32(OutputStream out, int value) throws IOException {
        little16(out, value); little16(out, value >> 16);
    }
}
