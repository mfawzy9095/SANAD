# SANAD V9.0.2 Device Test 2 — Pre-upload Gate

Status: READY FOR ISOLATED BRANCH BUILD

## Gates passed before upload
- JavaScript syntax: PASS
- Browser smoke boot: PASS (no page errors)
- Finance sequential gate: 45/45 PASS
- Data/backup/delete cleanup gate: 10/10 PASS
- Android static/security gate: 22/22 PASS
- UI smoke at 390x844: PASS
  - no horizontal overflow
  - Cairo applied
  - Arabic RTL / English LTR
  - Light / Dark

## Blocker found and fixed
The original Android wrapper treated every HTML file input as an image chooser. That would make JSON backup import impossible in the APK. Device Test 2 now distinguishes image inputs from document inputs and opens ACTION_OPEN_DOCUMENT for JSON backups.

## Deliberately excluded from this device gate
- Firebase credentials / live cloud sync validation
- Native Google sign-in
- Native biometric lock
- SMS / bank notification ingestion
- Microphone / Whisper

These exclusions are intentional so the first physical-device gate validates local financial integrity, IndexedDB persistence, receipts and backup/restore without introducing unrelated services.
