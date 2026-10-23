package com.deyvid.backend.service;

import com.deyvid.backend.dto.request.ContentAdaptRequest;
import com.deyvid.backend.dto.request.SaveContentVariantRequest;
import com.deyvid.backend.entity.ContentVariant;
import com.deyvid.backend.entity.DraftPreview;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.repository.ContentVariantRepository;
import com.deyvid.backend.repository.DraftPreviewRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;
import java.util.HashMap;
import java.util.Map;
import java.lang.reflect.Proxy;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

class ContentVariantServiceTest {
    private final UUID tenantId = UUID.randomUUID();
    private final UUID draftId = UUID.randomUUID();
    private final Map<ContentAdaptRequest.Channel, ContentVariant> savedVariants = new HashMap<>();
    private final AtomicBoolean hasPublicationAttempts = new AtomicBoolean();
    private final java.util.List<String> auditActions = new java.util.ArrayList<>();
    private Tenant tenant;
    private DraftPreview draft;
    private ContentVariantService service;

    @BeforeEach
    void setUp() {
        savedVariants.clear();
        hasPublicationAttempts.set(false);
        auditActions.clear();
        tenant = Tenant.builder().id(tenantId).appTargetCharacters(1200).build();
        draft = DraftPreview.builder().id(draftId).tenant(tenant).isPreview(false).isQueued(false).build();
        DraftPreviewRepository drafts = proxy(DraftPreviewRepository.class, (method, args) -> switch (method) {
            case "findOwnedForUpdate", "findByIdAndTenantId" -> draftId.equals(args[0]) && tenantId.equals(args[1])
                    && draftId.equals(draft.getId())
                    ? Optional.of(draft) : Optional.empty();
            default -> throw new UnsupportedOperationException(method);
        });
        ContentVariantRepository variants = proxy(ContentVariantRepository.class, (method, args) -> switch (method) {
            case "findByDraft_IdAndTenant_IdAndChannel" -> Optional.ofNullable(savedVariants.get(args[2]));
            case "findByDraft_IdAndTenant_IdOrderByUpdatedAtDesc" -> savedVariants.values().stream().toList();
            case "save" -> {
                ContentVariant variant = (ContentVariant) args[0];
                if (variant.getId() == null) variant.setId(UUID.randomUUID());
                savedVariants.put(variant.getChannel(), variant);
                yield variant;
            }
            default -> throw new UnsupportedOperationException(method);
        });
        PublicationAttemptService attempts = new PublicationAttemptService(null) {
            @Override public boolean hasAttempts(UUID id) { return hasPublicationAttempts.get(); }
        };
        AuditLogService audit = new AuditLogService(null) {
            @Override public void recordAction(Tenant owner, String email, String action, String details) {
                auditActions.add(action + ":" + details);
            }
        };
        service = new ContentVariantService(variants, drafts, attempts, audit);
    }

    @Test
    void savesVariantForOwnedDraftWithoutApprovingOrPublishing() {
        var response = service.save(tenantId, draftId, "author@example.com",
                new SaveContentVariantRequest(ContentAdaptRequest.Channel.X, "  Una versión corta  "));

        assertEquals("Una versión corta", response.text());
        assertEquals("X", response.channel());
        assertEquals(17, response.characterCount());
        assertEquals(280, response.recommendedCharacters());
        assertFalse(draft.isQueued());
        assertEquals(1, savedVariants.size());
        assertEquals("CONTENT_VARIANT_SAVED:Variante editorial guardada para X", auditActions.get(0));
    }

    @Test
    void rejectsDraftOutsideTenant() {
        draft.setId(UUID.randomUUID());

        assertThrows(IllegalArgumentException.class, () -> service.save(tenantId, draftId, "author@example.com",
                new SaveContentVariantRequest(ContentAdaptRequest.Channel.X, "Texto")));

        assertTrue(savedVariants.isEmpty());
    }

    @Test
    void rejectsQueuedDraft() {
        draft.setQueued(true);

        assertThrows(IllegalArgumentException.class, () -> service.save(tenantId, draftId, "author@example.com",
                new SaveContentVariantRequest(ContentAdaptRequest.Channel.X, "Texto")));

        assertTrue(savedVariants.isEmpty());
    }

    @Test
    void rejectsDraftWithPublicationAttempt() {
        hasPublicationAttempts.set(true);

        assertThrows(IllegalArgumentException.class, () -> service.save(tenantId, draftId, "author@example.com",
                new SaveContentVariantRequest(ContentAdaptRequest.Channel.X, "Texto")));

        assertTrue(savedVariants.isEmpty());
    }

    @Test
    void enforcesTheSmallerOfTenantAndChannelCharacterLimits() {
        tenant.setAppTargetCharacters(10);

        assertThrows(IllegalArgumentException.class, () -> service.save(tenantId, draftId, "author@example.com",
                new SaveContentVariantRequest(ContentAdaptRequest.Channel.X, "12345678901")));

        assertTrue(savedVariants.isEmpty());
    }

    private static <T> T proxy(Class<T> type, RepositoryCall call) {
        return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, (proxy, method, args) -> {
            if (method.getDeclaringClass() == Object.class) return switch (method.getName()) {
                case "toString" -> type.getSimpleName() + " test proxy";
                case "hashCode" -> System.identityHashCode(proxy);
                case "equals" -> proxy == args[0];
                default -> null;
            };
            return call.invoke(method.getName(), args == null ? new Object[0] : args);
        }));
    }

    @FunctionalInterface
    private interface RepositoryCall {
        Object invoke(String method, Object[] args);
    }
}
