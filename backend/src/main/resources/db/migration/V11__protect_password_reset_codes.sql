ALTER TABLE password_reset_tokens ALTER COLUMN otp_code TYPE VARCHAR(255);
ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS failed_attempts INT NOT NULL DEFAULT 0;
-- Previously issued codes were stored in plaintext; require a new recovery request.
UPDATE password_reset_tokens SET is_used = TRUE WHERE is_used = FALSE;
