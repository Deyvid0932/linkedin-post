package com.deyvid.backend.service;

import com.deyvid.backend.entity.*;
import com.deyvid.backend.entity.enums.*;
import com.deyvid.backend.repository.*;
import com.deyvid.backend.service.ai.ImageGeneratorService;
import com.deyvid.backend.service.linkedin.LinkedInPublisherService;
import com.deyvid.backend.service.webhook.WebhookDeliveryService;
import org.junit.jupiter.api.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class ApprovedPublicationServiceTest {
    TenantRepository tenants = mock(TenantRepository.class);
    DraftPreviewRepository drafts = mock(DraftPreviewRepository.class);
    LinkedInCredentialRepository accounts = mock(LinkedInCredentialRepository.class);
    PublicationLogRepository logs = mock(PublicationLogRepository.class);
    PublicationLogService logService = mock(PublicationLogService.class);
    PublicationAttemptService attempts = mock(PublicationAttemptService.class);
    LinkedInPublisherService publisher = mock(LinkedInPublisherService.class);
    WebhookDeliveryService webhookDeliveryService = mock(WebhookDeliveryService.class);
    Tenant tenant = Tenant.builder().id(UUID.randomUUID()).build();
    LinkedInCredential target = LinkedInCredential.builder().id(UUID.randomUUID()).tenant(tenant).accountType(LinkedInAccountType.PERSON)
            .authorUrn("urn:li:person:test").isEnabled(true).maxPostsPerDay(2).build();
    DraftPreview draft = DraftPreview.builder().id(UUID.randomUUID()).tenant(tenant).sourceMode(SourceMode.BACKUP).isQueued(true)
            .targetCredentialId(target.getId()).generatedText("Reviewed content").build();
    ApprovedPublicationService service = new ApprovedPublicationService(tenants, drafts, accounts, logs, logService, attempts, mock(ImageGeneratorService.class), publisher, webhookDeliveryService);
    @BeforeEach void setup() {
        when(tenants.findByIdForUpdate(tenant.getId())).thenReturn(Optional.of(tenant));
        when(drafts.findFirstByTenantIdAndIsQueuedTrueOrderByCreatedAtAsc(tenant.getId())).thenReturn(Optional.of(draft));
        when(drafts.findOwnedForUpdate(draft.getId(), tenant.getId())).thenReturn(Optional.of(draft));
        when(accounts.findByTenantIdAndIsEnabledTrue(tenant.getId())).thenReturn(List.of(target));
        when(attempts.claim(any(), any(), any(), anyString())).thenReturn(true);
        when(publisher.publishSingleAccount(any(), any(), anyString(), any())).thenReturn("urn:li:share:real");
    }
    @Test void publishesOnlySelectedAccountAndConsumesApprovedDraft() {
        var other = LinkedInCredential.builder().id(UUID.randomUUID()).tenant(tenant).isEnabled(true).build();
        when(accounts.findByTenantIdAndIsEnabledTrue(tenant.getId())).thenReturn(List.of(other, target));
        assertEquals("PUBLISHED", service.publish(tenant.getId(), null).outcome());
        verify(publisher).publishSingleAccount(eq(tenant), eq(target), eq("Reviewed content"), isNull());
        verify(drafts).delete(draft);
    }
    @Test void dryRunDoesNotSendClaimOrConsume() {
        tenant.setIsDryRun(true);
        assertEquals("SIMULATED", service.publish(tenant.getId(), null).outcome());
        verifyNoInteractions(publisher, attempts);
        verify(drafts, never()).delete(any());
    }
    @Test void pauseAndMissingApprovalNeverPublish() {
        tenant.setIsEmergencyPaused(true);
        assertEquals("PAUSED", service.publish(tenant.getId(), null).outcome());
        verifyNoInteractions(publisher);
        tenant.setIsEmergencyPaused(false); draft.setQueued(false);
        assertThrows(IllegalArgumentException.class, () -> service.publish(tenant.getId(), null));
        verifyNoInteractions(publisher);
    }
    @Test void unconfirmedPreviousAttemptIsNeverRetriedAutomatically() {
        when(attempts.claim(any(), any(), any(), anyString())).thenReturn(false);
        assertEquals("REVIEW_REQUIRED", service.publish(tenant.getId(), null).outcome());
        verifyNoInteractions(publisher);
        verify(drafts, never()).delete(any());
    }
    @Test void networkFailureKeepsDraftAndMarksUnknown() {
        when(publisher.publishSingleAccount(any(), any(), anyString(), any())).thenThrow(new RuntimeException("timeout"));
        assertEquals("REVIEW_REQUIRED", service.publish(tenant.getId(), null).outcome());
        verify(attempts).finish(draft.getId(), target.getId(), "UNKNOWN", null);
        verify(drafts, never()).delete(any());
    }
    @Test void quotaIncludesDurableAttemptsEvenWhenHistoryHasBeenCleared() {
        when(attempts.countReserved(eq(tenant.getId()), eq(target.getEffectiveAuthorUrn()), any())).thenReturn(2L);
        assertEquals("REVIEW_REQUIRED", service.publish(tenant.getId(), null).outcome());
        verifyNoInteractions(publisher, logs);
        verify(attempts, never()).claim(any(), any(), any(), anyString());
        verify(drafts, never()).delete(any());
    }
}
