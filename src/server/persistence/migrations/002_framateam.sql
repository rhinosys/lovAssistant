-- 002_framateam.sql
-- Framateam (Mattermost) integration: admin settings, channel selection, per-thread RAG chunks, GDPR tombstones.

CREATE TABLE IF NOT EXISTS framateam_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    base_url TEXT NOT NULL,
    team_name TEXT NOT NULL,
    login_id TEXT NOT NULL,
    password_enc TEXT,
    trigger_keyword TEXT NOT NULL DEFAULT '!lov',
    accept_mentions BOOLEAN NOT NULL DEFAULT FALSE,
    sync_interval_min INTEGER NOT NULL DEFAULT 60 CHECK (sync_interval_min >= 15),
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS framateam_channels (
    channel_id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    index_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    listen_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    initial_page INTEGER NOT NULL DEFAULT 0,
    initial_done BOOLEAN NOT NULL DEFAULT FALSE,
    last_sync_ms BIGINT NOT NULL DEFAULT 0,
    last_synced_at TIMESTAMPTZ,
    last_error TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS framateam_chunks (
    id TEXT PRIMARY KEY,
    root_post_id TEXT NOT NULL,
    channel_id TEXT NOT NULL REFERENCES framateam_channels(channel_id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    permalink TEXT NOT NULL,
    thread_created_at TIMESTAMPTZ NOT NULL,
    thread_updated_at TIMESTAMPTZ NOT NULL,
    content_hash TEXT NOT NULL,
    -- ids of the posts included, so a single reply can be located for GDPR removal
    post_ids TEXT[] NOT NULL DEFAULT '{}',
    -- mistral-embed vectors; cosine computed in the app (pgvector not required on YunoHost)
    embedding REAL[],
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_framateam_chunks_root ON framateam_chunks(root_post_id);
CREATE INDEX IF NOT EXISTS idx_framateam_chunks_channel ON framateam_chunks(channel_id);
CREATE INDEX IF NOT EXISTS idx_framateam_chunks_post_ids ON framateam_chunks USING GIN (post_ids);

CREATE TABLE IF NOT EXISTS framateam_forgotten (
    post_id TEXT PRIMARY KEY,
    root_post_id TEXT,
    channel_id TEXT,
    reason TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_framateam_forgotten_root ON framateam_forgotten(root_post_id);
