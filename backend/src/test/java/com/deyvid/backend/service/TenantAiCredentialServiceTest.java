package com.deyvid.backend.service;

import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.entity.TenantAiCredential;
import com.deyvid.backend.repository.TenantAiCredentialRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;
import java.lang.reflect.Proxy;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class TenantAiCredentialServiceTest {
    private TenantAiCredentialRepository repository;
    private TenantAiCredentialService service;
    private Tenant tenant;
    private TenantAiCredential persisted;

    @BeforeEach
    void setUp() {
        repository = createRepository();
        service = new TenantAiCredentialService(repository, new EncryptionService("0123456789abcdef0123456789abcdef"), null);
        tenant = Tenant.builder().id(UUID.randomUUID()).build();
    }

    @Test
    void encryptsWorkspaceKeyAndReturnsOnlyConfigurationStatus() {
        var result = service.save(tenant, "deepseek-text", "deepseek-test-private-key", "owner@example.com");

        TenantAiCredential saved = persisted;
        assertNotEquals("deepseek-test-private-key", saved.getEncryptedApiKey());
        assertEquals("deepseek-test-private-key", new EncryptionService("0123456789abcdef0123456789abcdef")
                .decrypt(saved.getEncryptedApiKey()));
        assertTrue(result.workspaceKeyConfigured());
        assertEquals("WORKSPACE", result.effectiveSource());
        assertFalse(result.toString().contains("deepseek-test-private-key"));
    }

    @Test
    void neverReturnsAnotherTenantsKey() {
        TenantAiCredential saved = TenantAiCredential.builder()
                .tenant(tenant)
                .provider("NANOGPT_IMAGE")
                .encryptedApiKey(new EncryptionService("0123456789abcdef0123456789abcdef")
                        .encrypt("nanogpt-private-key"))
                .build();
        persisted = saved;

        assertEquals("nanogpt-private-key", service.getApiKey(tenant.getId(), TenantAiCredentialService.Provider.NANOGPT_IMAGE));
        assertNull(service.getApiKey(UUID.randomUUID(), TenantAiCredentialService.Provider.NANOGPT_IMAGE));
    }

    @Test
    void rejectsUnlistedProvidersAndInvalidKeys() {
        assertThrows(IllegalArgumentException.class,
                () -> service.save(tenant, "https://attacker.example", "valid-looking-private-key", "owner@example.com"));
        assertThrows(IllegalArgumentException.class,
                () -> service.save(tenant, "deepseek-text", "short", "owner@example.com"));
        assertNull(persisted);
    }

    @Test
    void removingWorkspaceKeyFallsBackWithoutReturningTheSecret() {
        service.save(tenant, "nanogpt-image", "nanogpt-private-key", "owner@example.com");
        var result = service.delete(tenant, "nanogpt-image", "owner@example.com");

        assertFalse(result.workspaceKeyConfigured());
        assertEquals("NONE", result.effectiveSource());
        assertNull(service.getApiKey(tenant.getId(), TenantAiCredentialService.Provider.NANOGPT_IMAGE));
    }

    private TenantAiCredentialRepository createRepository() {
        return (TenantAiCredentialRepository) Proxy.newProxyInstance(
                TenantAiCredentialRepository.class.getClassLoader(),
                new Class<?>[]{TenantAiCredentialRepository.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "findByTenantIdAndProvider" -> persisted != null
                            && persisted.getTenant().getId().equals(args[0])
                            && persisted.getProvider().equals(args[1]) ? Optional.of(persisted) : Optional.empty();
                    case "save" -> { persisted = (TenantAiCredential) args[0]; yield persisted; }
                    case "deleteByTenantIdAndProvider" -> {
                        if (persisted != null && persisted.getTenant().getId().equals(args[0])
                                && persisted.getProvider().equals(args[1])) persisted = null;
                        yield null;
                    }
                    case "toString" -> "InMemoryTenantAiCredentialRepository";
                    case "hashCode" -> System.identityHashCode(proxy);
                    case "equals" -> proxy == args[0];
                    default -> throw new UnsupportedOperationException(method.getName());
                });
    }
}
