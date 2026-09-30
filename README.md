# SANAD V9.0.3 — Android Device Test 3

This is an isolated Android wrapper for the tested SANAD V9.0.3 web finance core.

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

## Device Test 3 changes
- Fixed Android Back navigation (dialog/sheet/tab before exit).
- Expanded English translations for search/account/card flows.
- Debit cards remain directly linked to a selected bank account.
- Prepaid cards now choose existing balance vs funding from an account; account funding is recorded as a transfer.
- Added prepaid top-up shortcut.
- Receipt capture is visible in the primary transaction flow.
- Amount entry moved lower, immediately above cards/accounts.
