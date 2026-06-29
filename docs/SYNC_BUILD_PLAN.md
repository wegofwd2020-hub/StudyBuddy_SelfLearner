# Zero-Knowledge Library Sync — Build Plan

> **Status:** Scoping (not started). Deferred past v1.1 per **ADR-014 O3**.
> **Covers:** ADR-014 follow-up tickets **#4** (sync API + envelope encryption +
> recovery UX) and **#5** (provenance-driven degradation UX).
> **Owner decision pending:** see [Open questions](#open-questions) before Phase 0.
> **Authoritative model:** ADR-014 **D5, D6, D10, D11** and **O2/O3/O4** — this doc
> turns those decisions into a buildable plan; where they differ, the ADR wins.

The product ships **device-local only** today: keys re-entered per device, library
local, the exported EPUB/PDF artifact as the cross-device story. This plan is the
opt-in **convenience** layer on top of that baseline — never a replacement for it.

---

## 1. Goal & non-goals

**Goal.** Let a signed-in user opt into syncing their **library content** across their
own devices, stored on our server as ciphertext **we cannot read** (zero-knowledge,
ADR-014 O2/D10), with a recovery story that survives a lost device (O4).

**In scope (tickets #4 + #5):**
- Per-user envelope encryption (D10): passphrase/recovery-key → KEK → per-user LMK →
  per-book Data Keys → content.
- Sync API (push/pull) over Supabase Postgres + RLS, holding only ciphertext + the
  minimal cleartext metadata D6 needs.
- Sync-setup, new-device-unlock, and recovery-key UX.
- Degradation UX (D6): a synced book whose provider key is absent on this device →
  read/export works, regenerate/edit-with-AI prompts for the key.

**Explicitly out of scope (separate tickets / ADRs):**
- **Credential (BYOK key) sync** — D5 `synced_e2e`. Same envelope mechanism, deferred
  with this build; can ride as a later phase (§7). Keys stay device-local until then.
- **Book sharing across users** — D11 tier 2 (public-key per-book-DK wrapping). Tier 1
  (export the artifact) is already live and unaffected.
- **Managed-key vault + metering Phase 2** — ADR-005 follow-up, unrelated.
- **Server-side rendering / search over content** — rejected by O2 (would need
  plaintext); the reader is offline/client-side (ADR-004).

---

## 2. Crypto model (from ADR-014 D10)

```
passphrase ──KDF(Argon2id, per-user salt)──▶ KEK_pass ─┐
                                                        ├─wrap─▶ LMK (random 256-bit, per-user, once)
recovery key ──KDF──────────────────────────▶ KEK_rec ─┘            │
                                                                    └─wrap─▶ DK_book (random per book)
                                                                                 │
                                                                                 └─AEAD──▶ book ciphertext
```

- **LMK is per-user, never per-device.** Server stores **two wrapped copies** of the
  LMK — one under `KEK_pass`, one under `KEK_rec` — so either secret unlocks any
  device. Server never sees the unwrapped LMK or either KEK.
- **New device:** enter passphrase (or recovery key) → derive KEK → unwrap LMK →
  decrypt library. The device caches the LMK in `expo-secure-store`
  (Android-Keystore-backed) so it isn't re-entered each launch — **that cached copy is
  the only per-device artifact** (D10).
- **Per-book DKs** (not content-under-LMK directly): costs nothing, and is the
  precondition for D11 tier-2 sharing of a single book without exposing the rest.
- **AEAD per book** with a fresh random nonce per encryption; bind `book_id` + version
  as associated data so ciphertext can't be transplanted between books.

### Crypto building blocks — gap analysis
The repo already encrypts the session token at rest in
`mobile/src/secure/largeSecureStore.ts` (AES-256 via `aes-js` + random bytes from
`expo-crypto`). That pattern is reusable but **insufficient as-is**:

| Need | Have today | Gap |
|---|---|---|
| CSPRNG bytes | `expo-crypto.getRandomBytes` | ok |
| AEAD (AES-256-**GCM** or XChaCha20-Poly1305) | `aes-js` is CTR/CBC, **no AEAD** | **pick a lib** (Phase 0) |
| Password KDF (Argon2id / scrypt) | none | **pick a lib** (Phase 0) |
| Hermes: no global `crypto` | `@/lib/uuid` shim (Hermes has no global `crypto`) | any lib must be Hermes-safe; no `crypto.*` at call sites |

Phase 0 picks one AEAD + one KDF that run under Hermes on low-end Android. Candidates:
`@noble/ciphers` + `@noble/hashes` (pure-JS, audited, Hermes-safe — simplest) vs a
native module (`react-native-quick-crypto` / `react-native-libsodium` — faster KDF,
heavier integration, may break Expo Go). **Recommendation: start with `@noble/*`** for
correctness + portability; revisit native only if Argon2id is too slow on target
hardware.

---

## 3. Data model (Supabase Postgres)

All tables RLS-scoped to the authenticated user. The mapping is `account.idp_sub =
auth.uid()` (textbook single-table RLS — ADR-014 O1); no `school_id` dance.

```
account_keyring            -- one row per user (extends the existing account row)
  account_id     PK/FK
  wrapped_lmk_pass   bytea     -- LMK wrapped under KEK_pass
  wrapped_lmk_rec    bytea     -- LMK wrapped under KEK_rec
  kdf_params         jsonb     -- algo, salt, mem/time/parallelism (for re-derive)
  created_at, rotated_at

synced_book
  book_id        PK           -- client-generated UUID (@/lib/uuid)
  account_id     FK (RLS)
  ciphertext     bytea         -- AEAD(DK, book content)  ← opaque to server
  wrapped_dk     bytea         -- DK wrapped under LMK
  nonce          bytea
  -- CLEARTEXT metadata (deliberate, minimal — see below):
  provider_id    text          -- D6 degradation needs this without decrypting
  model_id       text
  content_version int           -- optimistic-concurrency / conflict detection
  updated_at     timestamptz
  deleted        bool          -- tombstone (sync deletes across devices)
```

**Cleartext-metadata decision (needs sign-off — see open questions).** D6 degradation
requires *other devices to know a book's provider/model without decrypting it*, so
`provider_id`/`model_id` are stored cleartext. Everything content-bearing — **title,
topics, body, provenance detail** — is inside `ciphertext`. Consequence: a new device,
before unlock, sees "N encrypted books, each made with `<provider>`" but **not their
titles**. The library list shows placeholders until unlock. (Alternative: also store an
encrypted-title blob the client can decrypt for the list — same unlock requirement,
no extra leak. Defer unless the placeholder UX tests poorly.)

This satisfies D8 (data minimisation): the row holds an IdP-keyed pointer + ciphertext
+ provider/model + timestamps, and **nothing readable about what the user generated**.

---

## 4. Sync API

Thin REST under `/api/v1/sync/*` (backend verifies the IdP JWT as today; the backend
is a relay — it also cannot read content). Could be Supabase-direct from the client
with RLS, but routing through our backend keeps one auth seam and lets us rate-limit
(D9). **Recommend backend-mediated.**

| Endpoint | Purpose |
|---|---|
| `GET  /sync/keyring` | Fetch `wrapped_lmk_*` + `kdf_params` for unlock on a new device |
| `PUT  /sync/keyring` | First-time setup / passphrase rotation (re-wrap LMK) |
| `GET  /sync/books?since=<cursor>` | Pull changed rows (ciphertext + metadata + tombstones) since cursor |
| `PUT  /sync/books/{id}` | Push one encrypted book (with `content_version` for optimistic concurrency) |
| `DELETE /sync/books/{id}` | Tombstone a book |

**Conflict model.** Per-book **optimistic concurrency** on `content_version`: push with
the version you read; server rejects (409) if it advanced; client re-pulls and
**last-write-wins by `updated_at`** with a user-visible "kept newest" note. No CRDT /
operational-transform at v1.x — books are coarse-grained documents, not co-edited.
(Revisit only if real-time co-editing is ever requested.)

---

## 5. Recovery (ADR-014 O4)

- **One-time recovery key** generated client-side at sync setup, shown once
  (1Password-style), used to derive `KEK_rec` and produce `wrapped_lmk_rec`. We store
  only the wrapped LMK — never the recovery key.
- **Exported artifact = standing fallback.** The synced library is a *convenience copy*,
  not the only copy (D11/O4). If both passphrase and recovery key are lost, content is
  unrecoverable **by design** (true zero-knowledge) — the user still has any EPUB/PDF
  they exported. The setup flow must state this plainly.
- **Passphrase change** = re-derive `KEK_pass`, re-wrap LMK, `PUT /sync/keyring`. LMK
  and all DKs are unchanged, so **no content re-encryption** — cheap.

---

## 6. Phasing

| Phase | Deliverable | Gate |
|---|---|---|
| **0 — Crypto spike** | Pick AEAD + KDF; benchmark Argon2id on a low-end Android; thin `@/lib/envelope` wrapper + property tests (encrypt→decrypt, wrong-key fails, tamper fails). No network. | Decides lib before anything else is built |
| **1 — Envelope core** | `@/lib/envelope`: KEK derivation, LMK wrap/unwrap, DK per book, AEAD. 100% unit-tested, offline. | Phase 0 lib chosen |
| **2 — Server + schema** | Migration `0002` (keyring + synced_book), RLS policies, `/sync/*` endpoints, backend tests (auth, RLS isolation, 409 concurrency). | — |
| **3 — Setup & unlock UX** | Sync-setup flow (create passphrase → show recovery key → confirm), new-device unlock, LMK cache in `expo-secure-store`. | Phases 1+2 |
| **4 — Sync engine** | Push/pull against `bookStore.ts` as the local source of truth; cursor + tombstones + LWW conflict handling; manual "Sync now" + background-on-foreground. | Phase 3 |
| **5 — Degradation UX (#5)** | Provider-key-absent state: read/export OK; regenerate/edit prompts "made with `<provider>` — add key or switch". Drives off cleartext `provider_id` + existing `TrustBadge`/provenance. | Phase 4 (needs synced books to exist) |
| **6 — (optional, later)** | Credential sync (D5 `synced_e2e`) reusing the same LMK envelope; and/or D11 tier-2 public-key sharing. Separate go/no-go. | Demand-driven |

**Local source of truth** stays `mobile/src/storage/bookStore.ts` — sync is an
overlay that pushes/pulls its rows. Device-local-only users are unaffected (no keyring,
no opt-in, no behaviour change).

---

## 7. Risks & mitigations

- **Argon2id cost on low-end Android** (interactive unlock must feel instant-ish) →
  benchmark in Phase 0; tune mem/time params, store them in `kdf_params` so they can
  rise over time without breaking old keyrings.
- **Unrecoverable-by-design data loss** → the export-artifact fallback (O4) + blunt
  copy at setup ("if you lose both, we cannot recover this — your exports are your
  backup"). This is a feature of zero-knowledge, not a bug, but it's a support-load and
  trust risk if undercommunicated.
- **Crypto-in-RN footguns** (nonce reuse, AAD omission, Hermes lib breakage) →
  centralise in one audited `@/lib/envelope`; never hand-roll at call sites; property
  tests for tamper/wrong-key; CI runs them under Hermes.
- **Conflict edge cases** (two devices edit offline) → coarse per-book LWW with a
  visible "kept newest"; accept the small risk over CRDT complexity at this scale.
- **Metadata leak scope creep** → keep the cleartext set frozen at
  `{provider_id, model_id, version, timestamps, deleted}`; any addition needs a D8
  re-review.

## 8. Test plan
- **Envelope (Phase 1):** encrypt→decrypt round-trip; wrong passphrase fails closed;
  bit-flip in ciphertext/nonce/AAD fails; recovery-key path unwraps the same LMK;
  passphrase rotation preserves content.
- **Server (Phase 2):** RLS — user A cannot read/write user B's rows; 409 on stale
  `content_version`; tombstone propagation; the backend never logs ciphertext or key
  material (extend the existing key-redaction log test).
- **Sync engine (Phase 4):** two-device converge (push/pull/delete); offline-edit
  conflict → LWW + notice; large library pagination by cursor.
- **No live external services in CI** (project rule) — mock Supabase + backend.

## Open questions
1. **Cleartext metadata set (§3).** Confirm `provider_id`/`model_id` cleartext is
   acceptable, and whether to add an encrypted-title blob for a nicer pre-unlock list.
   *(Recommend: provider/model cleartext yes; encrypted title later if placeholders
   test poorly.)*
2. **Crypto library (§2).** `@noble/*` pure-JS vs a native module. *(Recommend noble
   first; native only if Phase 0 benchmarks force it.)*
3. **Sync transport (§4).** Backend-mediated vs Supabase-direct-with-RLS. *(Recommend
   backend-mediated — one auth seam + rate-limit hook.)*
4. **Sync trigger.** Manual-only, on-foreground, or live? *(Recommend manual +
   on-foreground for v1.x; no realtime.)*
5. **Version target.** This is "past v1.1" (O3) — pin it to a concrete release before
   Phase 0 so it doesn't float.
