## 1. Shared answering pipeline (refactor, no behaviour change)

- [x] 1.1 Extract evidence collection, draft, review, `renderEvidence` and web fallback from `src/app/api/chat/route.ts` into `answerQuestion()` in `src/server/chat/answer.ts`; the route keeps streaming events and persistence — verify `npm test` (existing `src/app/api/api.test.ts` chat tests) passes unchanged.
- [x] 1.2 Add `src/server/chat/answer.test.ts` with a mocked provider covering: sourced answer, no evidence (`NO_EVIDENCE`), web fallback requested — verify the new tests pass.

## 2. Admin access control

- [x] 2.1 In `src/server/auth/session.ts`, add the `admin` role when the trusted `x-lov-admin: 1` header is present, and from `ADMIN_USERS` only when `NODE_ENV !== "production"`; add `requireAdmin()` throwing `AuthorizationError` — verify with tests in `src/server/auth/auth.test.ts` (header grants, missing header denies, `ADMIN_USERS` ignored in production with `x-username`).
- [x] 2.2 Add `ADMIN_USERS`, `APP_ENCRYPTION_KEY` (optional, validated 32 bytes base64/hex) and `FRAMATEAM_*` optional vars to `src/server/config.ts` and `.env.example` — verify with cases in `src/server/config.test.ts`.
- [x] 2.3 Implement `encryptSecret`/`decryptSecret` (AES-256-GCM, `v1:` format) in `src/server/admin/secrets.ts` — verify round-trip, tampered ciphertext rejection and missing-key error in `src/server/admin/secrets.test.ts`.

## 3. Database

- [x] 3.1 Write `src/server/persistence/migrations/002_framateam.sql` (`framateam_settings`, `framateam_channels`, `framateam_chunks` with `real[]` embedding, `framateam_forgotten`, indexes) — verify `npm run db:migrate` applies it on a local Postgres and is idempotent on a second run.
- [x] 3.2 Add `IFramateamStore` with `PgFramateamStore` and `InMemoryFramateamStore` (settings, channels, chunks replace/delete by thread, tombstones, search candidates) following the repository pattern of `src/server/persistence/repositories/` — verify with `src/server/framateam/store.test.ts` against the in-memory implementation.
- [x] 3.3 Implement `getFramateamSettings()` resolving DB → env → none with `source` tag, decrypting the password server-side — verify DB-over-env precedence, env fallback and "none" in tests.

## 4. Framateam API client

- [x] 4.1 Create `src/server/framateam/client.ts` with injectable `fetch`/clock, serial queue with min spacing, `login()` reading the `Token` header, MFA error mapping — verify with mocked responses in `src/server/framateam/client.test.ts` (fixtures under `src/server/framateam/__fixtures__/`).
- [x] 4.2 Add 401 → re-login → single retry, 429 `Retry-After`, 5xx/network exponential backoff with max attempts — verify each path with fake timers.
- [x] 4.3 Add `getMe`, `getTeamByName`, `listPublicChannels` (paged), `getChannelPosts` (page and `since`), `getPostThread`, `addReaction`, `removeReaction`, `createPost` — verify request URLs, bodies and parsing against fixtures.

## 5. Admin API and UI

- [x] 5.1 Add `GET/PUT /api/admin/framateam/settings` (password write-only, empty keeps existing, `passwordConfigured` flag, `source`, `NOTIFY framateam_config` on save) — verify in `src/app/api/admin.test.ts`: 403 for members, password never in any response body, empty password keeps stored value.
- [x] 5.2 Add `POST /api/admin/framateam/test` returning connected username and team display name or a typed error — verify success, invalid credentials and MFA cases with mocked client.
- [x] 5.3 Add `GET /api/admin/framateam/channels` (refresh from API, new channels disabled) and `PATCH /api/admin/framateam/channels/[id]` (index/listen flags; disabling index purges chunks) — verify with tests.
- [x] 5.4 Add `POST /api/admin/framateam/sync` (409 when busy) and `POST /api/admin/framateam/forget` (post id/permalink or channel) — verify busy refusal and forget effects with tests.
- [x] 5.5 Build `src/app/admin/page.tsx` and `src/app/admin/framateam/page.tsx` (account form with "Remplacer le mot de passe", test button, channel table with toggles, sync status and button, forget-by-permalink field, active config source), using `apiUrl()` and existing Tailwind styles; show an admin link in the chat UI only when `/api/admin/me` returns 200 — verify in the browser preview with `ADMIN_USERS` in dev: save, test, toggle, sync, and that a non-admin user gets 403.

## 6. Ingestion and incremental sync

- [x] 6.1 Implement `buildThreadDocuments()` in `src/server/framateam/thread-chunker.ts` (grouping by root, system/deleted/own/tombstoned posts dropped, `@mention` → `@membre`, no author names, useless-post and `minChars` filters, long-thread splitting with root prefix, permalink, `content_hash`) — verify with `thread-chunker.test.ts` including a check that no username from fixtures appears in any chunk.
- [x] 6.2 Implement `syncFramateam()` in `src/server/framateam/sync.ts` with advisory lock, channel refresh/purge, resumable initial paging, `since` incremental with cap fallback, thread rebuild, hash skip, embeddings, per-channel `last_error` — verify with `sync.test.ts` using mocked client, in-memory store and fake embeddings: initial load, resume after interruption, new reply, edit, deletion, unchanged hash not re-embedded, private channel never fetched.
- [ ] 6.3 Add `scripts/framateam-sync.ts` and `npm run framateam:sync` — verify `npm run framateam:sync -- --help` and a run against `.env` credentials on the real team (manual, one enabled channel).

## 7. Retrieval integration

- [x] 7.1 Add optional precomputed `queryVector` to `RAGRetrievalService.search` and `searchFramateamThreads()` (hybrid score, grouped by thread, bounded text) — verify with `src/server/framateam/search.test.ts`.
- [x] 7.2 Extend `EvidenceSource.origin` with `"Framateam"`, add Framateam threads in `collectEvidence()` with graceful degradation, and add the "member discussions, lower authority" paragraph to `evidencePrompt` — verify in `src/server/chat/grounding.test.ts`: Framateam source cited with its permalink, DB failure leaves other sources intact, prompt contains the authority rule.

## 8. Real-time bot

- [x] 8.1 Implement `FramateamBot` in `src/server/framateam/bot.ts` (websocket auth challenge, `posted` parsing, filters: public type `O`, listen-enabled, not self, keyword or opt-in mention) — verify with `bot.test.ts` using a fake WebSocket: triggers, ignores DM/private/non-enabled/self.
- [x] 8.2 Implement the reply flow (👀 reaction → thread member questions → `answerQuestion` → reply with `root_id` → remove reaction; error message on failure; per-channel concurrency and busy reply) — verify call order and `root_id` in tests.
- [x] 8.3 Implement reconnection (ping/pong watchdog, backoff with jitter capped at 5 min, re-login, 15-minute catch-up), `LISTEN framateam_config` reload, idle mode when unconfigured, periodic sync timer — verify with fake timers and a fake socket that closes.
- [ ] 8.4 Add `scripts/framateam-bot.ts` and `npm run framateam:bot` — verify manually against Framateam with the `nrineau` account in a test public channel: `!lov` question gets 👀 then an in-thread sourced reply; a mention without keyword does nothing.

## 9. GDPR tooling and docs

- [x] 9.1 Implement `forgetPost()` / `forgetChannel()` in `src/server/framateam/privacy.ts` and `scripts/framateam-forget.ts` (`--post <id|permalink>`, `--channel <name>`, `--list`) — verify with tests: reply removal rebuilds thread, root removal deletes thread, tombstone survives a full reload, removed thread no longer returned by search.
- [x] 9.2 Document configuration, admin usage, GDPR procedures, personal-vs-dedicated account and pgvector upgrade path in `docs/rag-maintenance.md` and `README.md` — verify the docs mention every new env var and npm script.

## 10. YunoHost package (`~/Projects/admin_lova_ynh`)

- [ ] 10.1 Add the `admin` permission (`/admin` + `/api/admin`, allowed `admins`, no tile, protected) in `manifest.toml`; add an nginx location for the admin paths setting `X-Lov-Admin "1"` and strip it in the main location — verify with `nginx -t` on the test server and a request as non-admin returning 403/SSO refusal.
- [ ] 10.2 Generate and persist `APP_ENCRYPTION_KEY` in install/upgrade, add `FRAMATEAM_*` placeholders to the env template, add and enable `admin_lova-framateam` systemd unit, include it in remove/backup/restore — verify an install and an upgrade on the test YunoHost: both services active, bot idle until configured.

## 11. Verification

- [x] 11.1 Run `npm test` and `npm run build`; confirm all tests pass and the build has no type errors.
- [ ] 11.2 End-to-end on the test instance: configure account in admin, enable one public channel, sync, ask a question in the web chat that cites a Framateam permalink, ask the same via `!lov` in Framateam, then forget the thread and confirm it is no longer cited.
