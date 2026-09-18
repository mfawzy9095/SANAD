#include <jni.h>
#include <android/asset_manager.h>
#include <android/asset_manager_jni.h>
#include <android/log.h>
#include <stdlib.h>
#include <string.h>
#include "whisper.h"

#define TAG "SANAD-Whisper"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

static size_t asset_read(void *ctx, void *output, size_t read_size) {
    return AAsset_read((AAsset *)ctx, output, read_size);
}
static bool asset_eof(void *ctx) {
    return AAsset_getRemainingLength64((AAsset *)ctx) <= 0;
}
static void asset_close(void *ctx) { AAsset_close((AAsset *)ctx); }

JNIEXPORT jlong JNICALL
Java_com_sanad_full_whisper_WhisperLib_initContextFromAsset(JNIEnv *env, jclass clazz, jobject assetManager, jstring pathStr) {
    (void)clazz;
    const char *path = (*env)->GetStringUTFChars(env, pathStr, NULL);
    AAssetManager *mgr = AAssetManager_fromJava(env, assetManager);
    AAsset *asset = AAssetManager_open(mgr, path, AASSET_MODE_STREAMING);
    (*env)->ReleaseStringUTFChars(env, pathStr, path);
    if (!asset) return 0;
    struct whisper_model_loader loader = {
        .context = asset,
        .read = asset_read,
        .eof = asset_eof,
        .close = asset_close,
    };
    struct whisper_context_params cparams = whisper_context_default_params();
    struct whisper_context *ctx = whisper_init_with_params(&loader, cparams);
    return (jlong)ctx;
}

JNIEXPORT void JNICALL
Java_com_sanad_full_whisper_WhisperLib_freeContext(JNIEnv *env, jclass clazz, jlong ptr) {
    (void)env; (void)clazz;
    if (ptr) whisper_free((struct whisper_context *)ptr);
}

JNIEXPORT jstring JNICALL
Java_com_sanad_full_whisper_WhisperLib_transcribeArabic(JNIEnv *env, jclass clazz, jlong ptr, jint threads, jfloatArray audioData) {
    (void)clazz;
    if (!ptr || !audioData) return (*env)->NewStringUTF(env, "");
    struct whisper_context *ctx = (struct whisper_context *)ptr;
    jsize n = (*env)->GetArrayLength(env, audioData);
    jfloat *audio = (*env)->GetFloatArrayElements(env, audioData, NULL);

    struct whisper_full_params p = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
    p.print_realtime = false;
    p.print_progress = false;
    p.print_timestamps = false;
    p.print_special = false;
    p.translate = false;
    p.language = "ar";
    p.n_threads = threads > 0 ? threads : 4;
    p.offset_ms = 0;
    p.no_context = true;
    p.single_segment = false;

    int rc = whisper_full(ctx, p, audio, n);
    (*env)->ReleaseFloatArrayElements(env, audioData, audio, JNI_ABORT);
    if (rc != 0) {
        LOGE("whisper_full failed: %d", rc);
        return (*env)->NewStringUTF(env, "");
    }

    int count = whisper_full_n_segments(ctx);
    size_t total = 1;
    for (int i = 0; i < count; ++i) {
        const char *s = whisper_full_get_segment_text(ctx, i);
        if (s) total += strlen(s) + 1;
    }
    char *out = (char *)calloc(total, 1);
    if (!out) return (*env)->NewStringUTF(env, "");
    for (int i = 0; i < count; ++i) {
        const char *s = whisper_full_get_segment_text(ctx, i);
        if (!s) continue;
        strcat(out, s);
        strcat(out, " ");
    }
    jstring result = (*env)->NewStringUTF(env, out);
    free(out);
    return result;
}
