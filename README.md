# SANAD 1.1 Test

Android test build using the recovered SANAD master.

## Included
- Approved icon option 1 (leaf + finance bars)
- Approved interface direction 2 (dark green + cream)
- Native splash
- Encrypted SQLite database (AES-GCM key stored in Android Keystore)
- Automatic migration from older `sanad.v7` localStorage when present
- Local adaptive learning from confirmed merchant/category/text patterns
- Bank notification capture with OTP/security filtering and duplicate prevention
- Optional manual import of existing bank SMS (runtime READ_SMS permission)
- Android on-device voice recognition only; no cloud fallback
- JSON backup/restore with Android file picker
- No `INTERNET` permission

## Voice note
On-device Arabic recognition depends on the Android speech service/model installed on the phone. SANAD includes a **Prepare offline voice** action that asks Android to prepare the selected offline model where supported.

## Test status
Core JS suite: **42/42 PASS** before Android build. GitHub Actions compiles and verifies the APK.
