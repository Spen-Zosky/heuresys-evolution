-- Migration 129: Add 2FA TOTP support to users table
-- Adds columns for TOTP secret, enabled flag, hashed recovery codes, and lockout tracking

ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_recovery_codes TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_failed_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_lockout_until TIMESTAMP WITH TIME ZONE;

-- Track in schema_migrations
INSERT INTO schema_migrations (version, applied_at)
VALUES (129, NOW())
ON CONFLICT (version) DO NOTHING;
