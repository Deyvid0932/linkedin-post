ALTER TABLE tenants
    ALTER COLUMN app_image_model SET DEFAULT 'qwen-image-2.1/text-to-image';

ALTER TABLE tenants
    DROP CONSTRAINT IF EXISTS chk_tenant_app_image_model;

UPDATE tenants
SET app_image_model = 'qwen-image-2.1/text-to-image'
WHERE app_image_model IN ('flux-schnell', 'flux-dev')
   OR app_image_model IS NULL;

ALTER TABLE tenants
    ADD CONSTRAINT chk_tenant_app_image_model CHECK (app_image_model IN (
        'recraft-ai/recraft-v4.1-flash/text-to-image',
        'qwen-image-2.1/text-to-image',
        'bytedance/seedream-v5.0-flash',
        'seedream-v4',
        'nano-banana',
        'nano-banana-2-fast',
        'black-forest-labs/flux-3/text-to-image',
        'google/gemini-nano-banana-2.1',
        'ideogram/v4.5',
        'gpt-image-2',
        'qwen-image-2.1-pro',
        'nano-banana-pro',
        'gpt-image-1.5'
    ));
