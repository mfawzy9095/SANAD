# SANAD / سند — V2.2 Release Candidate

This repository builds the reviewed SANAD V2.2 Android project.

## V2.2 scope
- Original SANAD interface retained
- Cairo font loading for Android WebView
- Local encrypted SQLite state with Android Keystore
- One-time legacy `sanad.v7` migration
- Local adaptive merchant/category/phrase learning
- Android on-device speech recognition only (no cloud fallback)
- Bank notification capture + historical SMS import
- OTP/PIN/CVV/password filtering and duplicate protection
- Backup / Restore through Android document picker
- Safe-to-Spend, savings goals, recurring bills, debts/installments
- No `android.permission.INTERNET`

The exact reviewed source package is stored in `release-v22-parts/` and reconstructed by GitHub Actions. Its tar.xz SHA-256 is:

`2cb06c5b043850aba85f788515d7a71257767a626c4e201f344446cd349f8477`

GitHub Actions produces:
- `SANAD-V2.2-APK`
- `SANAD-V2.2-FULL-PROJECT`

The APK is a debug-signed test build intended for direct device testing before any store release.
