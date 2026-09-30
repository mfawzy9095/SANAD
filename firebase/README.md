# SANAD V9.1 Firebase Foundation

These files define the intended production boundary for SANAD cloud work.

## Current state

- V9.0.7 Local Stable does **not** connect to Firebase.
- No production Firebase project is assumed or embedded.
- Rules in this folder are source-controlled design artifacts until they are tested in the Firebase Emulator Suite and deployed to a real project.
- Phone lookup and family membership mutation remain backend-only.

## Required project setup

1. Create a dedicated Firebase project for SANAD.
2. Enable Google Authentication.
3. Create Cloud Firestore in the chosen production region.
4. Enable Cloud Storage in the same project.
5. Register the Web/Android clients.
6. Configure authorized domains and Android SHA fingerprints when native Google sign-in is introduced.
7. Test Firestore and Storage rules in Emulator Suite before deployment.
8. Deploy indexes/rules only after auth-isolation tests pass.

## Mandatory emulator tests

- User A cannot read/write User B records.
- Unauthenticated users cannot read any financial records.
- ownerUid and id cannot be changed after create.
- revision must increment by exactly 1.
- normal client hard-delete is denied.
- phone directory and invite collections are unreadable/unwritable by clients.
- non-family member cannot read shared transactions.
- family member can read shared projection but not private owner records.
- only owner of a shared projection can update/delete it.
- receipt upload rejects non-image content and files >= 15 MB.
- user cannot read another user's receipt.

## Deployment

The eventual deployment commands are expected to be:

```bash
firebase use <SANAD_PROJECT_ID>
firebase emulators:exec --only firestore,storage "npm test"
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Do not run the deploy step until the emulator suite is green and the project ID is explicitly selected.
