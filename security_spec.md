# Security Specification — DJOUMA FOOT LIVE Firestore Rules

## 1. Data Invariants
1. `users/{userId}` can only be read, created, or updated by `request.auth.uid == userId` with a verified email (`email_verified == true`), and `uid`/`createdAt` are immutable after creation.
2. `users/{userId}/preferences/{prefId}` requires the parent `users/{userId}` document to exist (Master Gate), is readable/writable strictly by the owner, and caps `favoriteClubIds` and `favoriteCompetitionIds` arrays at 50 items max.
3. `live_cache/{cacheId}` and `competitions_catalog/{competitionId}` are public read-only sports feeds (`write: if false` for all clients; written exclusively by trusted Firebase Cloud Functions / Admin SDK).
4. `test/connection` allows single-document `get` only for SDK health verification and forbids all writes/lists.
5. No client can inject shadow fields (`isAdmin`, `role`), spoof another user's `userId`, forge server timestamps (`request.time`), or query/list private user records.

## 2. Adversarial Payloads Blocked (Dirty Dozen)
1. Unauthenticated read on `/users/u1` -> DENIED.
2. Authenticated user `u2` reading `/users/u1` (cross-user PII read) -> DENIED.
3. Unverified user (`email_verified: false`) writing `/users/u1` -> DENIED.
4. User profile creation with shadow field `{ isAdmin: true }` -> DENIED (`hasOnly` check).
5. User profile update attempting to mutate `uid` or `createdAt` -> DENIED.
6. Client timestamp spoofing (`createdAt != request.time`) -> DENIED.
7. Oversized `userId` path variable (> 128 chars or invalid chars) -> DENIED (`isValidId`).
8. Unbounded array injection (`favoriteClubIds.size() > 50`) in preferences -> DENIED.
9. Orphaned preferences write when parent `/users/{userId}` does not exist -> DENIED (`exists` Master Gate).
10. Client write attempt to `/live_cache/scoreboard` -> DENIED (`allow write: if false`).
11. Client write attempt to `/competitions_catalog/sr-comp-1` -> DENIED (`allow write: if false`).
12. Blanket `list` query on `/users` -> DENIED (`allow list: if false`).
