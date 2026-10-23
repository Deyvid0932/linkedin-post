CREATE TABLE account_invitations (
    id UUID PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITHOUT TIME ZONE,
    revoked_at TIMESTAMP WITHOUT TIME ZONE,
    CONSTRAINT ck_account_invitation_terminal_state
        CHECK (accepted_at IS NULL OR revoked_at IS NULL),
    CONSTRAINT ck_account_invitation_hash_length
        CHECK (length(token_hash) = 64)
);

CREATE INDEX idx_account_invitations_created_at
    ON account_invitations (created_at DESC);

CREATE UNIQUE INDEX uq_account_invitations_open_email
    ON account_invitations (LOWER(email))
    WHERE accepted_at IS NULL AND revoked_at IS NULL;
