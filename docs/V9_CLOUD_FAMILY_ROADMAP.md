# SANAD V9 — Cloud & Family Foundation

## Stable base
Development starts from `checkpoint-v8.9.1-web`. Never develop new cloud/auth features directly on the checkpoint branch.

## Phase A — Product foundation
1. SANAD branding everywhere.
2. Arabic + English with RTL/LTR switching.
3. Light + dark mode.
4. Preserve local-first operation and existing financial integrity checks.
5. Receipt camera/file attachment UX with local metadata first.

## Phase B — Account and cloud
Backend: Firebase.
- Firebase Authentication: Google sign-in.
- Cloud Firestore: user data + shared-family data.
- Cloud Storage: receipt images.
- Offline persistence enabled on supported web/mobile clients.
- Local IndexedDB remains a resilience/cache layer; cloud sync never silently overwrites local financial data.

### Sync safety rules
- Every record gets `id`, `ownerUid`, `updatedAt`, `deviceId`, and `revision`.
- Soft-delete/tombstones for synchronized deletes.
- Conflict detection instead of blind last-write overwrite for critical financial records.
- Import/export JSON remains available as an independent backup path.
- Cloud sync is opt-in until the user signs in.

## Phase C — Family sharing
Do NOT expose a global phone-number directory in the browser.

Proposed model:
- `families/{familyId}`
- `families/{familyId}/members/{uid}`
- shared financial records reference `familyId`
- user profile may contain a verified phone number
- invite-by-phone is handled server-side (Cloud Function / secure backend)
- only verified invited accounts can join
- roles: owner, adult/member, viewer (optional later)

## Phase D — App lock / biometrics
Web:
- Use WebAuthn/passkey platform authenticator only when supported.
- Treat it as an optional privacy/app-unlock layer.
- Never store or receive fingerprint data.
- Do not block access irrecoverably: recovery through signed-in account/device re-authentication.

Android later:
- Use native BiometricPrompt for local app lock after the cloud/auth foundation is stable.

## Phase E — Receipt capture
- Camera input with rear camera preference.
- Compress image before upload.
- Local attachment metadata while offline.
- Firebase Storage path scoped by user/family.
- OCR is a separate later capability; never auto-book expenses without user review.

## Phase F — Bank transaction ingestion
Preferred Android path:
1. NotificationListener for bank/payment notifications.
2. Parse into pending/review transactions.
3. User confirms before posting to ledger.

Direct `READ_SMS` is not the default architecture because Google Play heavily restricts SMS permissions for non-default SMS/Assistant apps.

## Release gates
A feature branch cannot become production until:
- finance regression passes,
- migration/backup/restore passes,
- offline/online reconciliation passes,
- auth isolation tests pass (User A cannot read User B),
- family permissions tests pass,
- receipt storage rules pass,
- RTL/LTR and light/dark UI tests pass,
- mobile viewport tests pass,
- repeated cold-start/reload cycles pass.
