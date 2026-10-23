package com.deyvid.backend.service;

import com.deyvid.backend.dto.response.AiProviderStatusResponse;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.entity.TenantAiCredential;
import com.deyvid.backend.repository.TenantAiCredentialRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TenantAiCredentialService {
    public enum Provider {
        DEEPSEEK_TEXT("deepseek-text", "DeepSeek · generación de texto"),
        NANOGPT_IMAGE("nanogpt-image", "NanoGPT · generación de imágenes");

        private final String path;
        private final String label;

        Provider(String path, String label) {
            this.path = path;
            this.label = label;
        }

        public String path() { return path; }
        public String label() { return label; }

        public static Provider parse(String value) {
            if (value == null) throw new IllegalArgumentException("Proveedor de IA no disponible");
            String normalized = value.trim().toLowerCase(Locale.ROOT);
            for (Provider provider : values()) if (provider.path.equals(normalized)) return provider;
            throw new IllegalArgumentException("Proveedor de IA no disponible");
        }
    }

    private final TenantAiCredentialRepository repository;
    private final EncryptionService encryptionService;
    private final AuditLogService auditLogService;

    @Value("${DEEPSEEK_API_KEY:${LLM_API_KEY:${spring.ai.openai.api-key:}}}")
    private String serverDeepseekKey;

    @Value("${NANOGPT_API_KEY:${NANOGPT_KEY:}}")
    private String serverNanoGptKey;

    @Transactional
    public AiProviderStatusResponse save(Tenant tenant, String providerName, String rawKey, String actorEmail) {
        Provider provider = Provider.parse(providerName);
        String key = validateKey(rawKey);
        UUID tenantId = tenant.getId();
        TenantAiCredential credential = repository.findByTenantIdAndProvider(tenantId, provider.name())
                .orElseGet(() -> TenantAiCredential.builder().tenant(tenant).provider(provider.name()).build());
        credential.setEncryptedApiKey(encryptionService.encrypt(key));
        repository.save(credential);
        if (auditLogService != null) auditLogService.recordAction(tenant, actorEmail, "AI_PROVIDER_KEY_UPDATED", provider.path());
        return status(tenantId, provider);
    }

    @Transactional
    public AiProviderStatusResponse delete(Tenant tenant, String providerName, String actorEmail) {
        Provider provider = Provider.parse(providerName);
        repository.deleteByTenantIdAndProvider(tenant.getId(), provider.name());
        if (auditLogService != null) auditLogService.recordAction(tenant, actorEmail, "AI_PROVIDER_KEY_DELETED", provider.path());
        return status(tenant.getId(), provider);
    }

    @Transactional
    public List<AiProviderStatusResponse> statuses(UUID tenantId) {
        return List.of(status(tenantId, Provider.DEEPSEEK_TEXT), status(tenantId, Provider.NANOGPT_IMAGE));
    }

    @Transactional
    public String getApiKey(UUID tenantId, Provider provider) {
        if (tenantId == null || provider == null) return null;
        return repository.findByTenantIdAndProvider(tenantId, provider.name())
                .map(TenantAiCredential::getEncryptedApiKey)
                .map(encryptionService::decrypt)
                .filter(key -> !key.isBlank())
                .orElse(null);
    }

    public boolean hasApiKey(UUID tenantId, Provider provider) {
        String key = getApiKey(tenantId, provider);
        return key != null && !key.isBlank();
    }

    private AiProviderStatusResponse status(UUID tenantId, Provider provider) {
        var credential = repository.findByTenantIdAndProvider(tenantId, provider.name());
        boolean workspaceConfigured = credential.isPresent();
        boolean fallbackConfigured = hasServerKey(provider);
        String source = workspaceConfigured ? "WORKSPACE" : fallbackConfigured ? "SERVER" : "NONE";
        return new AiProviderStatusResponse(provider.path(), provider.label(), workspaceConfigured,
                fallbackConfigured, source, credential.map(TenantAiCredential::getUpdatedAt).orElse(null));
    }

    private boolean hasServerKey(Provider provider) {
        String key = provider == Provider.DEEPSEEK_TEXT ? serverDeepseekKey : serverNanoGptKey;
        return key != null && !key.isBlank() && !key.toLowerCase(Locale.ROOT).contains("placeholder");
    }

    private String validateKey(String rawKey) {
        if (rawKey == null) throw new IllegalArgumentException("La clave API es obligatoria");
        String key = rawKey.trim();
        if (key.length() < 8 || key.length() > 512 || key.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException("La clave debe tener entre 8 y 512 caracteres y no contener controles");
        }
        return key;
    }
}
