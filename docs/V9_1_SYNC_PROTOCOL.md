# SANAD V9.1 Sync Protocol

## Release gate

Do not enable this protocol in production until V9.0.7 has passed physical-device persistence, receipt camera/gallery, backup/export/import and cold-start tests.

## Local namespaces

V9.0.7 keeps the existing local database untouched.

V9.1 introduces a storage adapter with scopes:

- `guest`: unsigned local-only data
- `uid:<firebaseUid>`: signed-in user's local cache

The first sign-in must not silently move guest data. The user must choose whether to import the existing local ledger into the signed-in account. The import uses the same strict schema/fingerprint/rollback path as backup restore.

## Pull

1. Authenticate user.
2. Read per-collection changes newer than the local sync cursor.
3. Validate every document and owner UID.
4. Compare remote revision with local base revision.
5. Apply non-conflicting records to a candidate state.
6. Run strict schema validation.
7. Recompute finance invariants.
8. Write a pre-sync local snapshot.
9. Persist using verified write/readback.
10. Advance sync cursor only after the durable write succeeds.

## Push

1. Read pending local mutations.
2. Reject any mutation with invalid schema or owner scope.
3. Fetch current remote record.
4. If remote revision differs from the mutation's base revision, stop and record a conflict.
5. Commit the record with revision + 1 and server timestamp.
6. For deletes, commit/update a tombstone.
7. Mark the local mutation acknowledged only after Firestore confirms the write.

## No blind last-write-wins for finance

Timestamp-only conflict resolution is prohibited for transactions, transfers, repayments, account definitions and opening balances.

## Idempotency

Every local mutation receives a unique `mutationId`. Replaying the same acknowledged mutation must not create a duplicate transaction.

## Receipts

Receipt upload happens after the owning transaction has a valid cloud record. Receipt metadata is committed only after Storage upload succeeds. Failed uploads remain locally pending and never block the financial transaction itself.

Deleting a transaction queues receipt deletion. Orphan-pruning runs after sync and after restore.

## Family

Family sharing is a separate projection pipeline:

- private transaction stays under `users/{uid}/transactions`
- explicit share creates/updates one sanitized `sharedTransactions` document
- unshare creates a deletion/update for that shared projection
- deleting the owner transaction also deletes/tombstones the shared projection

## Recovery

If a sync batch fails halfway:

- local candidate state is discarded or rolled back
- acknowledged remote writes remain idempotent
- unacknowledged mutations stay pending
- sync cursor is not advanced
- user data is not replaced by a partial remote snapshot
