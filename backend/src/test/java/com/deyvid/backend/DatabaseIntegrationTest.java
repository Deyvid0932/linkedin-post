package com.deyvid.backend;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import com.deyvid.backend.entity.*;
import com.deyvid.backend.entity.enums.LinkedInAccountType;
import com.deyvid.backend.repository.*;
import com.deyvid.backend.service.*;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "RUN_DB_TESTS", matches = "true")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=${TEST_DB_URL}", "spring.datasource.username=${TEST_DB_USERNAME}", "spring.datasource.password=${TEST_DB_PASSWORD}",
        "app.jwt.secret=test-only-jwt-key-with-more-than-32-bytes", "app.security.encryption-key=12345678901234567890123456789012",
        "app.scheduler.mode=actions", "app.llm.api-key=", "spring.ai.openai.api-key=", "app.vision.api-key="
})
class DatabaseIntegrationTest {
    @Autowired Environment environment;
    @Autowired TenantRepository tenants;
    @Autowired UserRepository users;
    @Autowired LinkedInCredentialRepository accounts;
    @Autowired PublishingScheduleRepository schedules;
    @Autowired DraftPreviewRepository drafts;
    @Autowired AutomationService automation;
    @Autowired EncryptionService encryption;
    @Autowired PublicationAttemptService attempts;
    @Autowired org.springframework.transaction.support.TransactionTemplate transactions;

    private RestClient client() { return RestClient.create("http://localhost:" + environment.getProperty("local.server.port")); }
    private Map<?, ?> register(String email) {
        return client().post().uri("/api/v1/auth/register").body(Map.of("name", "Audit Test", "email", email, "password", "Password123!"))
                .retrieve().body(Map.class);
    }

    @Test void completeDraftFlowIsIsolatedAndDryRunPreservesQueue() {
        String email = UUID.randomUUID() + "@example.test";
        String token = (String) register(email).get("token");
        String otherToken = (String) register(UUID.randomUUID() + "@example.test").get("token");
        var owner = users.findByEmailIgnoreCase(email).orElseThrow();
        var tenant = owner.getTenant();
        tenant.setIsDryRun(true); tenants.save(tenant);
        var account = accounts.save(LinkedInCredential.builder().tenant(tenant).accountType(LinkedInAccountType.PERSON)
                .authorUrn("urn:li:person:audit").displayName("Audit account").isPrimary(true).isEnabled(true).isValid(true)
                .accessTokenEnc(encryption.encrypt("test-token-never-sent"))
                .tokenIssuedAt(LocalDateTime.now()).tokenExpiresAt(LocalDateTime.now().plusDays(10)).build());
        Map<?, ?> saved = client().post().uri("/api/v1/content/drafts").headers(h -> h.setBearerAuth(token))
                .body(Map.of("title", "A reviewed idea", "text", "A real manually authored post", "tone", "TECHNICAL", "audience", "Developers", "goal", "TEACH", "targetCredentialId", account.getId()))
                .retrieve().body(Map.class);
        String id = (String) saved.get("id");
        assertEquals(false, saved.get("queued"));
        assertEquals(0L, drafts.countByTenantIdAndIsQueuedTrue(tenant.getId()));
        var forbidden = assertThrows(RestClientResponseException.class, () -> client().post().uri("/api/v1/content/drafts/" + id + "/approve")
                .headers(h -> h.setBearerAuth(otherToken)).body(Map.of()).retrieve().body(Map.class));
        assertEquals(400, forbidden.getStatusCode().value());
        var approved = client().post().uri("/api/v1/content/drafts/" + id + "/approve").headers(h -> h.setBearerAuth(token))
                .body(Map.of()).retrieve().body(Map.class);
        assertEquals(true, approved.get("queued"));
        schedules.save(PublishingSchedule.builder().tenant(tenant).cronExpression("0 0 8 ? * *").isActive(true).build());
        Instant now = Instant.parse("2026-10-04T13:07:00Z");
        assertEquals(1, automation.runDue(tenant.getId(), now).processed());
        assertEquals(0, automation.runDue(tenant.getId(), now.plusSeconds(30)).processed());
        assertEquals(1L, drafts.countByTenantIdAndIsQueuedTrue(tenant.getId()));
    }

    @Test void passwordChangeRevokesOldJwtAndMissingAuthReturns401() {
        String email = UUID.randomUUID() + "@example.test";
        String token = (String) register(email).get("token");
        client().put().uri("/api/v1/users/me").headers(h -> h.setBearerAuth(token))
                .body(Map.of("currentPassword", "Password123!", "newPassword", "ChangedPassword123!"))
                .retrieve().body(Map.class);
        var revoked = assertThrows(RestClientResponseException.class, () -> client().get().uri("/api/v1/tenant/profile")
                .headers(h -> h.setBearerAuth(token)).retrieve().body(Map.class));
        assertEquals(401, revoked.getStatusCode().value());
        var absent = assertThrows(RestClientResponseException.class, () -> client().get().uri("/api/v1/content/drafts").retrieve().body(List.class));
        assertEquals(401, absent.getStatusCode().value());
    }

    @Test void receiptPersistsAcrossRollbackWithoutBlockingOnTenantForeignKey() {
        String email = UUID.randomUUID() + "@example.test";
        register(email);
        UUID tenantId = users.findByEmailIgnoreCase(email).orElseThrow().getTenant().getId();
        UUID draftId = UUID.randomUUID(), accountId = UUID.randomUUID();
        transactions.executeWithoutResult(status -> {
            tenants.findByIdForUpdate(tenantId).orElseThrow();
            assertTimeout(Duration.ofSeconds(10), () -> assertTrue(attempts.claim(tenantId, draftId, accountId, "urn:li:person:receipt")));
            status.setRollbackOnly();
        });
        assertTrue(attempts.hasAttempts(draftId));
        assertFalse(attempts.claim(tenantId, draftId, accountId, "urn:li:person:receipt"));
        assertEquals(1, attempts.countReserved(tenantId, "urn:li:person:receipt", Instant.now().minusSeconds(60)));
    }
}
