package com.sanad.full.whisper;

import android.content.res.AssetManager;

public final class WhisperLib {
    static { System.loadLibrary("sanad_whisper"); }
    private WhisperLib() {}
    public static native long initContextFromAsset(AssetManager assetManager, String assetPath);
    public static native void freeContext(long contextPtr);
    public static native String transcribe(long contextPtr, int numThreads, float[] audioData, String language);
}
