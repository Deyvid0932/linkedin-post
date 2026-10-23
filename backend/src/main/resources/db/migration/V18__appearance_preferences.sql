ALTER TABLE users
    ADD COLUMN accent_color VARCHAR(16);

ALTER TABLE users
    ADD CONSTRAINT chk_user_accent_color
        CHECK (accent_color IS NULL OR accent_color IN ('red', 'blue', 'green', 'yellow'));

CREATE TABLE platform_appearance_settings (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    default_accent_color VARCHAR(16) NOT NULL DEFAULT 'red'
        CHECK (default_accent_color IN ('red', 'blue', 'green', 'yellow')),
    allowed_accent_colors VARCHAR(64) NOT NULL DEFAULT 'red,blue,green,yellow',
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO platform_appearance_settings (id, default_accent_color, allowed_accent_colors)
VALUES (1, 'red', 'red,blue,green,yellow');
