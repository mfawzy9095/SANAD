# SANAD / سند — V2.3 Bugfix Test

V2.3 is a targeted test build based on the reviewed V2.2 source.

## Fixes in V2.3
- Hardened bank/SMS amount extraction so balances, credit limits and reference numbers are not used as transaction amounts.
- Large or ambiguous imported amounts are sent to review instead of being silently auto-saved.
- Historical SMS import is conservative: only explicit high-confidence transaction amounts are preselected.
- Notification parsing no longer treats the generic phrase "credit limit" as a transaction signal.
- Offline voice retries Android recognizer service disconnection locally and tries Arabic locale candidates: ar-EG, ar-SA, ar-AE, ar.
- No cloud voice fallback was added.
- No INTERNET permission.

V2.3 patch SHA-256:
`ac4a0e183436970e39d9b251352d5083581bdc75db7f0fedb560e4f3436f9618`

GitHub Actions produces:
- `SANAD-V2.3-APK`
- `SANAD-V2.3-FULL-PROJECT`
