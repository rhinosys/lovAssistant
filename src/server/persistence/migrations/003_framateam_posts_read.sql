-- 003_framateam_posts_read.sql
-- Number of Framateam posts read per channel (total and during the last sync), shown in the admin.

ALTER TABLE framateam_channels ADD COLUMN IF NOT EXISTS posts_read BIGINT NOT NULL DEFAULT 0;
ALTER TABLE framateam_channels ADD COLUMN IF NOT EXISTS last_run_posts INTEGER NOT NULL DEFAULT 0;
