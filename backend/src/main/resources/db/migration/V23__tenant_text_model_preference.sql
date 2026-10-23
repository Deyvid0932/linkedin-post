ALTER TABLE tenants
    ADD COLUMN app_text_model VARCHAR(60) NOT NULL DEFAULT 'deepseek-flash';

ALTER TABLE tenants
    ADD CONSTRAINT ck_tenants_app_text_model
        CHECK (app_text_model IN ('deepseek-flash', 'deepseek-v4-pro'));
