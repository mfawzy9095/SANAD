# SANAD V3.5 — Voice Handoff / Backup

## Purpose
This is the handoff point for the SANAD Android project after repeated microphone failures on physical devices.

## Current voice architecture
V3.5 intentionally uses ONE offline voice path only:

Android AudioRecord (16 kHz mono PCM16)
→ bundled whisper.cpp
→ bundled multilingual ggml-base-q5_1.bin
→ partial/final transcript
→ SANAD existing voice parser.

There is NO Android SpeechRecognizer path and NO INTERNET permission.

## Why V3.5 changed the architecture
Previous V3.x versions mixed Android on-device SpeechRecognizer and Whisper. That introduced OEM/service/language-pack variability and multiple JS voice state controllers.

V3.5 removes that variability:
- AudioRecord opens immediately when the user taps Voice.
- Whisper model loading happens concurrently with recording.
- MIC source is tried first.
- VOICE_RECOGNITION is fallback.
- AudioRecord ERROR_DEAD_OBJECT / ERROR_INVALID_OPERATION triggers one recorder recreation.
- Android client-silenced state is detected on API 29+.
- Near-silent captures explicitly report that Mic access may be disabled.
- Quiet captures are normalized before Whisper.
- The recording is not rejected merely because a fixed VAD threshold was not crossed.
- Recording stops when the app goes to background.
- One JS controller only: assets/v35_voice.js.

## Version
- applicationId: com.sanad.full
- versionCode: 35
- versionName: 3.5-whisper-only
- minSdk: 26
- targetSdk: 35
- ABI: arm64-v8a

## Key files
- app/src/main/java/com/sanad/full/WhisperVoiceEngine.java
- app/src/main/java/com/sanad/full/OfflineVoiceEngine.java
- app/src/main/java/com/sanad/full/MainActivity.java
- app/src/main/assets/v35_voice.js
- app/src/main/cpp/whisper_jni.c
- app/src/main/cpp/CMakeLists.txt
- qa/test-v35-whisper-only.js

## Expected physical-device flow
1. Open Add → Voice.
2. RECORD_AUDIO permission is requested once if needed.
3. AudioRecord starts immediately.
4. UI reports listening even if Whisper model is still loading.
5. Speak Arabic or English.
6. After silence or Stop, Whisper converts recorded PCM locally.
7. Transcript is passed to SANAD parser.

## Runtime diagnostics
The Voice screen includes a microphone diagnostics button.
runtimeDiagnostics returns:
- audioPermission
- voiceStatus
- engine=whisper_only
- AudioRecord source
- readError
- samples
- rms
- peak
- silenced
- model state

Interpretation:
- samples=0 → microphone opened but returned no frames.
- silenced=true → Android silenced the recording client.
- peak near 0 with many samples → global Mic access/privacy toggle likely off or OEM capture issue.
- model=failed → Whisper model initialization problem.
- samples/peak normal + model=ready + no text → inspect JNI/Whisper inference.

## Important signing note
The isolated Voice Test APK uses a separate applicationId suffix and can be installed beside the real SANAD app.
Do NOT use its debug signing certificate for future production SANAD updates.
Production updates must continue using the stable SANAD signing key from the prior signed release chain.

## Build
The GitHub Actions workflow for this branch downloads:
- whisper.cpp v1.7.6
- ggml-base-q5_1.bin

It then runs the V3.5 voice regression test, builds an isolated test APK, verifies permissions/resources, and packages a complete source backup.

## No-network guarantee
AndroidManifest.xml does not request android.permission.INTERNET.
Whisper model is bundled in the APK/project.
