# SANAD V3.6 — Critical Stabilization Handoff

## Release identity
- versionCode: 36
- versionName: `3.6-critical-stabilization`
- voice runtime: `app/src/main/assets/v36_voice.js`
- native engine: bundled `whisper.cpp` + `ggml-base-q5_1.bin`
- network fallback: none

## Critical changes in V3.6

### 1. Native Whisper performance is production-like in Debug APKs
`app/build.gradle` now passes an optimized native configuration and both `cFlags '-O3'` and `cppFlags '-O3'`.
`app/src/main/cpp/CMakeLists.txt` forces the native graph to Release and replaces Debug C/C++ flags with `-O3`, so ggml C files do not silently inherit `-O0` from an Android Debug variant.

The V3.6 CI does not trust configuration text alone. After `assembleDebug`, it parses generated `compile_commands.json` and fails if a ggml C compile command contains `-O0`, lacks `-O3`, or the generated `CMakeCache.txt` is not `Release`.

### 2. AudioRecord Stop race removed
`WhisperVoiceEngine.stop()` only publishes `recording=false`.
The audio worker remains the sole owner of `AudioRecord.stop()` / `release()` through `safeRelease()`.
A negative `read()` result after an intentional stop is no longer treated as a hardware failure and no recovery reopen is attempted.

### 3. Encrypted-state load failures are fail-closed
The Android bridge now returns a structured load envelope:
- success: `{ok:true, found:..., state:..., snapshots:n}`
- failure: `{ok:false, error:"state_load_failed", cause:..., snapshots:n}`

On a read/decrypt failure:
- Native `saveState()` is blocked.
- JS enters recovery read-only mode.
- Bank pending drain is not started.
- A blocking recovery overlay instructs the user to restore a trusted backup.
- Explicit backup recovery uses `saveRecoveredState()` and only then re-enables writes.

### 4. Last three encrypted states retained
Database schema is now v3 and includes `app_state_history`.
Every normal save executes in one SQLite transaction:
1. Copy the current encrypted `app_state` row to history.
2. Trim history to the latest three previous states.
3. Replace the current row.

Snapshots are retained encrypted; the snapshot operation never decrypts or rewrites the previous payload.

### 5. Web Speech / fake voice path removed
`index.html` no longer contains:
- `SpeechRecognition`
- `webkitSpeechRecognition`
- `sampleVoice()`
- random fake financial utterances used as a voice fallback

Voice support is native-only.

### 6. Finalization watchdog
`v36_voice.js` arms a 75-second watchdog whenever voice enters finalizing/processing.
If the native layer never returns Done/Error, the UI is returned to idle and the microphone controls are re-enabled with a visible timeout error.

### 7. Version identity unified
Current release identity is now consistent across:
- Gradle
- JS build marker
- voice runtime
- runtime diagnostics (`BuildConfig.VERSION_NAME`)
- JNI log tag messages
- QA report
- V3.6 CI/workflows

## Validation completed in this workspace
Passed:
- `node qa/test-v36-critical.js`
- `node --check app/src/main/assets/v36_voice.js`
- syntax validation of all inline JS in `index.html`
- `node qa/v27_parser_test.js`
- JVM `BankSmsParser` regression suite

Not executed locally:
- Android Gradle APK build
- generated CMake compile command verification
- physical-device microphone / Whisper inference

Those are enforced by `.github/workflows/build-v36.yml` because this workspace does not contain the Android SDK/Gradle toolchain.
