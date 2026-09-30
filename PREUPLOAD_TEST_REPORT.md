# SANAD V9.0.3 Device Test 3 — Pre-upload Gate

Status: READY FOR ISOLATED BRANCH BUILD

## User-reported issues fixed
- Android Back no longer exits immediately: dialog -> sheet -> previous tab -> Home -> exit.
- English coverage expanded for search, account creation, card creation and dialog defaults.
- Prepaid creation now asks whether balance already exists or is funded from an existing account.
- Funding a prepaid card from an account creates a real transfer: source decreases, prepaid balance increases, net assets do not double-count.
- Debit cards remain linked to one selected bank account; expenses post to that exact account.
- Receipt camera/chooser moved out of Advanced details into the primary transaction flow.
- Amount entry moved lower and remains immediately above the cards/accounts source selector.

## Targeted regression gates
- JavaScript syntax: PASS
- Browser/UI scan: PASS; no page errors, no horizontal overflow at 390x844.
- English search/account/card critical-flow scan: PASS.
- English default dialog buttons: PASS (Confirm / Cancel).
- Android/web back handler logic: PASS in browser contract test.
- Prepaid funded-from-account: PASS (1000 -> 700 bank, 0 -> 300 prepaid, one transfer).
- Prepaid existing-balance mode: PASS (does not deduct a bank account).
- Debit linked-account semantics: PASS.
- Amount above cards/accounts: PASS.
- Receipt camera available without opening Advanced details: PASS.

## Previously passed unchanged finance/data gates from Device Test 2
- Finance sequential gate: 45/45 PASS
- Data/backup/delete cleanup gate: 10/10 PASS
- Android static/security gate: 22/22 PASS

## Still requires physical-device validation
- Android Back gesture/button behavior in installed APK
- IndexedDB persistence after force-stop/reboot
- Camera capture and Android document picker
- Backup export/import on Android storage provider
