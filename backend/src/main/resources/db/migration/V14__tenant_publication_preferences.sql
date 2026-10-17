ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS app_approval_mode VARCHAR(24) NOT NULL DEFAULT 'REQUIRE_APPROVAL',
    ADD COLUMN IF NOT EXISTS app_target_characters INTEGER NOT NULL DEFAULT 1200,
    ADD COLUMN IF NOT EXISTS app_image_model VARCHAR(80) NOT NULL DEFAULT 'flux-schnell';

ALTER TABLE tenants
    ADD CONSTRAINT chk_tenant_app_approval_mode
        CHECK (app_approval_mode IN ('REQUIRE_APPROVAL', 'AUTOMATIC')),
    ADD CONSTRAINT chk_tenant_app_target_characters
        CHECK (app_target_characters BETWEEN 100 AND 3000),
    ADD CONSTRAINT chk_tenant_app_image_model
        CHECK (app_image_model IN ('flux-schnell', 'flux-dev'));
