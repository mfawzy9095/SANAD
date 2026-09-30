# SANAD V9.1 Cloud Data Model

Status: foundation design only. It is not enabled in the V9.0.7 Local Stable client.

## Principles

- Local-first: the device remains usable without Firebase.
- Per-record Firestore documents. Never upload the entire financial state as one document.
- Every synchronized financial record is owned by exactly one Firebase UID.
- Hard deletes are not part of normal client sync. Deletes produce tombstones.
- Private data is private by default. Family sharing copies only an explicit sanitized shared view.
- Phone numbers are never public document IDs and are never client-queryable as a directory.
- Receipts are private to the owner unless a future explicit receipt-sharing feature is designed.

## User tree

```
users/{uid}
  accounts/{accountId}
  instruments/{instrumentId}
  transactions/{transactionId}
  categories/{categoryId}
  tags/{tagId}
  people/{personId}
  recurring/{recurringId}
  budgets/{budgetId}
  savings/{savingId}
  receipts/{receiptId}
  tombstones/{tombstoneId}
  devices/{deviceId}
```

Each syncable record contains at minimum:

```json
{
  "id": "record-id",
  "ownerUid": "firebase-uid",
  "schemaVersion": 1,
  "revision": 1,
  "deviceId": "stable-device-id",
  "createdAt": "server timestamp",
  "updatedAt": "server timestamp",
  "deleted": false
}
```

The document ID and `id` field must match. `ownerUid` is immutable.

## Transactions

`users/{uid}/transactions/{transactionId}`

The cloud transaction is one ledger record, not a precomputed account balance. Balances and reports are derived from records using the same validated finance engine used locally.

Important fields may include:

- type
- accountId / fromAccountId / toAccountId
- paymentInstrumentId
- amount / fromAmount / toAmount
- currency / fromCurrency / toCurrency
- fxRate
- fee
- categoryId
- personId
- tags
- date
- recurringId
- repayment linkage
- receiptId
- note

No client stores a mutable authoritative "balance" as a substitute for ledger reconstruction.

## Tombstones

`users/{uid}/tombstones/{entityType}_{entityId}`

```json
{
  "id": "transaction_tx123",
  "ownerUid": "uid",
  "entityType": "transaction",
  "entityId": "tx123",
  "revision": 7,
  "deviceId": "deviceA",
  "deletedAt": "server timestamp",
  "updatedAt": "server timestamp",
  "schemaVersion": 1,
  "deleted": true
}
```

A sync delete is applied only when the tombstone revision is newer than the local base revision. This prevents an offline stale device from resurrecting a deleted record.

## Receipts

Metadata:
`users/{uid}/receipts/{receiptId}`

Binary:
`users/{uid}/receipts/{receiptId}/original.jpg`

Metadata references the owning transaction ID. Restore/sync must reject receipt metadata whose transaction does not exist or is tombstoned.

## Devices

`users/{uid}/devices/{deviceId}`

Contains non-secret sync metadata such as app version, last sync time and supported schema version. It must not contain biometric material, recovery codes, access tokens or raw device identifiers that are unnecessary for sync.

## Family tree

```
families/{familyId}
  members/{uid}
  sharedTransactions/{shareId}
```

The main family document contains only family-level metadata and owner UID.

Membership writes are server-controlled. A normal client cannot add itself directly.

### Shared transactions

A shared transaction is not the owner's full private transaction document.

`families/{familyId}/sharedTransactions/{shareId}` contains only the explicitly shared projection:

```json
{
  "id": "share-id",
  "familyId": "family-id",
  "ownerUid": "uid",
  "sourceTransactionId": "tx123",
  "type": "expense",
  "amount": 125.0,
  "currency": "AED",
  "date": "2026-09-30",
  "categoryLabel": "Groceries",
  "counterpartyLabel": "",
  "noteShared": "",
  "revision": 3,
  "updatedAt": "server timestamp",
  "deleted": false
}
```

Private notes, account numbers, card last-four, Firebase profile data, receipt URLs and unrelated tags are not copied automatically.

Unshare or owner transaction deletion removes/marks deleted the shared projection.

## Invites

Phone invite lookup is backend-only.

A future callable Cloud Function may accept an E.164 phone number, normalize it server-side, resolve only verified users and create a random invite token. Firestore rules deny direct client access to any phone directory.

Until that backend exists, phone-based family invites remain disabled.

## Conflict rule

Each local pending write stores the remote `baseRevision` it was edited from.

- remote revision == baseRevision: commit as revision + 1
- remote revision > baseRevision and payload differs: create a local conflict; do not overwrite
- same fingerprint: treat as already synchronized
- deleted/tombstoned remotely: never silently resurrect

Financial conflicts require explicit deterministic resolution before the affected record is uploaded.
