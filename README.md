# SANAD V9.0.2 — Android Device Test 2

This is an isolated Android wrapper for the tested SANAD V9.0.2 web finance core.

## Purpose
- Real-device persistence test for IndexedDB/WebView storage.
- Receipt camera/gallery attachment test.
- Full backup export/import test.
- Arabic/English, RTL/LTR, light/dark and finance-flow verification.

## Architecture
The embedded web app is loaded through AndroidX `WebViewAssetLoader` at:
`https://appassets.androidplatform.net/assets/index.html`

The package is intentionally separate (`com.sanad.v9test`) so it can coexist with older SANAD builds.

## Deliberately excluded from this first device gate
- READ_SMS
- Notification listener
- Microphone / Whisper
- Firebase credentials
- Native Google sign-in
- Native biometric lock

Those will be added only after local persistence and financial integrity pass on a physical device.
