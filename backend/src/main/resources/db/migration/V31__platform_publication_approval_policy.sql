CREATE TABLE platform_publication_policy (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    approval_required BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO platform_publication_policy (id, approval_required)
VALUES (1, FALSE);
