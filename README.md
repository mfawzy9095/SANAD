# SANAD / سند — V2.5 Whisper + Bank Review

V2.5 is a real-device test build focused on the two issues found in V2.4.

## Voice
- Replaces the Android on-device SpeechRecognizer path used by the UI with a bundled offline Whisper engine.
- Uses whisper.cpp v1.7.6 and the multilingual ggml-base-q5_1 model.
- Records locally until the user presses Finish, with live microphone activity.
- No Arabic speech package from Android/Samsung/Google is required for this voice path.
- No cloud speech fallback and no INTERNET permission at runtime.

## Bank SMS
- Historical SMS sync is review-first: imported messages do not become spending until confirmed.
- Subsequent refresh is incremental.
- Review shows raw SMS context and received date/time for safer correction and learning.

## App icon
- Uses the exact SANAD logo supplied by the user, resized only for Android launcher assets.

GitHub Actions bundles the Whisper model into the APK during build and produces:
- SANAD-V2.5-APK
- SANAD-V2.5-FULL-PROJECT
