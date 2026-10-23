ALTER TABLE tenants
    DROP CONSTRAINT IF EXISTS chk_tenant_app_image_model;

ALTER TABLE tenants
    ADD CONSTRAINT chk_tenant_app_image_model CHECK (app_image_model IN (
        'ideogram/v4/instant',
        'recraft-ai/recraft-v4.1-flash/text-to-image',
        'blackforestlabs/flux-3/klein/text-to-image',
        'qwen-image-2.1/text-to-image',
        'bytedance/seedream-v5.0-flash',
        'qwen-image-3',
        'seedream-v4',
        'nano-banana',
        'nano-banana-2-lite',
        'nano-banana-2-fast',
        'black-forest-labs/flux-3/text-to-image',
        'google/gemini-nano-banana-2.1',
        'ideogram/v4.5',
        'gpt-image-2',
        'qwen-image-2.1-pro',
        'qwen-image-3-pro',
        'nano-banana-pro',
        'gpt-image-1.5'
    ));
