# SANAD V3.6 Critical Stabilization — Changelog

Implemented from V3.5 baseline:

1. Native Whisper/ggml optimization
   - versionCode 36 / versionName `3.6-critical-stabilization`.
   - Gradle passes native Release + `cFlags '-O3'` + `cppFlags '-O3'`.
   - CMake forces Release native flags and replaces Debug `-O0` behavior with `-O3`.
   - CI inspects generated `compile_commands.json` and `CMakeCache.txt` after `assembleDebug`.

2. AudioRecord Stop race
   - `stop()` only sets `recording=false`.
   - Audio worker owns `AudioRecord.stop()/release()`.
   - Intentional stop cannot enter negative-read recovery/error path.

3. Fail-closed encrypted state loading
   - Bridge returns explicit `{ok,...}` load envelope.
   - Native save gate blocks writes after decrypt/read failure.
   - UI enters blocking read-only recovery mode.
   - Backup restore uses explicit `saveRecoveredState()` before writes are re-enabled.

4. Encrypted state snapshots
   - SQLite schema v3.
   - Current encrypted state is copied transactionally before overwrite.
   - Latest 3 previous states retained in `app_state_history`.

5. Legacy voice removal
   - Removed Web Speech API path from active `index.html`.
   - Removed `sampleVoice()` and random fake financial speech fallback.
   - Replaced V3.5 runtime with self-contained `v36_voice.js`.

6. Voice finalization watchdog
   - 75-second watchdog returns UI to idle if native Done/Error never arrives.

7. Version unification
   - Gradle, JS, runtime diagnostics, JNI logs, handoff, test report, and V3.6 CI identify the same release.

Local validation passed. Android APK/device validation remains for GitHub Actions / physical device because Android SDK/Gradle are not installed in the current workspace.
