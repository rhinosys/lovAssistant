## Why

Much of the LOV's practical know-how (machine quirks, material settings, workarounds) lives in the public channels of our Framateam team (Mattermost hosted by Framasoft), not in the wiki. The assistant cannot use it today, and members who ask questions in Framateam cannot reach the assistant without leaving the chat. We are not administrators of the instance, so the integration must work through a regular user account, be gentle with a shared associative instance, and respect GDPR.

## What Changes

- Add an **admin area** in the assistant (`/admin`), reserved to a dedicated YunoHost permission, where an admin configures the Framateam account (URL, team, login, password), tests the connection, and selects which public channels are indexed and which ones the bot answers in.
- Store the Framateam password **encrypted at rest** in PostgreSQL; never return it from any API. `.env` variables remain a supported fallback (development, or installs without the admin UI).
- Add a **Framateam API client** authenticating with `POST /api/v4/users/login` (session token), re-logging on 401, serialising and rate-limiting calls with backoff.
- **Ingest selected public channels** into PostgreSQL: initial paginated load, then incremental sync with `since`, chunked **per thread** (root + replies), without author names, with channel, date and permalink metadata. Edited and deleted posts are reflected.
- **Add Framateam as an evidence source** next to YesWiki and DokuWiki in grounded answers, cited with permalinks, and explicitly ranked below official wiki documentation.
- Add a **real-time bot service** (separate long-running process) listening to the Framateam websocket, answering in-thread when triggered in an allowed public channel, with a 👀 reaction during processing and robust reconnection.
- Add **GDPR controls**: opt-in channel allow-list, removal of a message or a whole channel from the index (admin UI and CLI), tombstones preventing re-ingestion.
- Extract the grounded-answer pipeline (draft → review → render → web fallback) from the chat route into a reusable server module, used by both the web chat and the bot. No behaviour change for the web chat.

## Capabilities

### New Capabilities
- `admin/access-control`: Admin role derived from a dedicated YunoHost permission (with a development fallback), and protection of the admin UI and admin API.
- `admin/framateam-settings`: Admin management of the Framateam account (encrypted secret, connection test) and of per-channel indexing / bot-listening flags, including sync status and manual sync trigger.
- `framateam/channel-ingestion`: Initial and incremental ingestion of selected public channels as anonymised per-thread chunks, rate-limited and resumable.
- `framateam/realtime-bot`: Websocket listener that answers triggered questions in-thread in allowed public channels, with reaction feedback and reconnection.
- `framateam/privacy-controls`: Removal of messages and channels from the index, tombstones, and guarantees on what is never indexed.
- `chat/framateam-evidence`: Use of indexed Framateam threads as a cited, lower-authority evidence source in grounded answers.

### Modified Capabilities
<!-- None: grounded answering, RAG and auth have no main spec under openspec/specs/ yet. -->

## Impact

- **Code**: new `src/server/framateam/` (client, chunker, sync, store, bot), `src/server/admin/` (guard, secret encryption, settings repository), `src/server/chat/answer.ts` (extracted pipeline), changes to `src/server/chat/grounding.ts`, `src/app/api/chat/route.ts`, `src/server/auth/session.ts`, `src/server/config.ts`; new pages `src/app/admin/…` and routes `src/app/api/admin/…`; new scripts `framateam:sync`, `framateam:bot`, `framateam:forget`.
- **Database**: migration `002_framateam.sql` (settings, channels, chunks with embeddings, tombstones).
- **Configuration**: new env vars `APP_ENCRYPTION_KEY`, optional `FRAMATEAM_*` fallbacks, `ADMIN_USERS` (development only).
- **Deployment**: YunoHost package `admin_lova_ynh` gets an `admin` permission (URL `/admin` + `/api/admin`), an nginx location injecting a trusted admin header, a second systemd service for the bot, and the new env vars.
- **External systems**: framateam.org API v4 and websocket, used through a regular user account with conservative request rates.
- **Dependencies**: none added (native `fetch` and Node 22 `WebSocket`).
