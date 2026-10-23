package com.deyvid.backend;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
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
        "app.scheduler.mode=manual", "app.llm.api-key=", "spring.ai.openai.api-key=", "app.vision.api-key="
})
class DatabaseIntegrationTest {
    @Autowired Environment environment;
    @Autowired TenantRepository tenants;
    @Autowired UserRepository users;
    @Autowired AiUsageEventRepository aiUsageEvents;
    @Autowired PublicationLogRepository publicationLogs;
    @Autowired LinkedInCredentialRepository accounts;
    @Autowired PublishingScheduleRepository schedules;
    @Autowired DraftPreviewRepository drafts;
    @Autowired EncryptionService encryption;
    @Autowired PublicationAttemptService attempts;
    @Autowired org.springframework.transaction.support.TransactionTemplate transactions;
    @Autowired JdbcTemplate jdbc;

    private RestClient client() { return RestClient.create("http://localhost:" + environment.getProperty("local.server.port")); }
    private String register(String email) {
        var csrfResponse = client().get().uri("/api/v1/auth/csrf").retrieve().toEntity(Map.class);
        String csrfToken = (String) csrfResponse.getBody().get("token");
        String csrfCookie = csrfResponse.getHeaders().getFirst(HttpHeaders.SET_COOKIE).split(";", 2)[0];
        var registered = client().post().uri("/api/v1/auth/register")
                .headers(headers -> {
                    headers.add(HttpHeaders.COOKIE, csrfCookie);
                    headers.set("X-XSRF-TOKEN", csrfToken);
                })
                .body(Map.of("name", "Audit Test", "email", email, "password", "Password123!"))
                .retrieve().toEntity(Map.class);
        String sessionCookie = registered.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        assertNotNull(sessionCookie);
        assertTrue(sessionCookie.contains("HttpOnly"));
        assertTrue(sessionCookie.contains("SameSite=Lax"));
        assertFalse(registered.getBody().containsKey("token"));
        return sessionCookie.split(";", 2)[0].substring("AUTOPOST_SESSION=".length());
    }

    @Test void completeDraftFlowIsIsolatedAndDryRunPreservesQueue() {
        String email = UUID.randomUUID() + "@example.test";
        String token = register(email);
        String otherToken = register(UUID.randomUUID() + "@example.test");
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
        assertEquals(1L, drafts.countByTenantIdAndIsQueuedTrue(tenant.getId()));
    }

    @Test void passwordChangeRevokesOldJwtAndMissingAuthReturns401() {
        String email = UUID.randomUUID() + "@example.test";
        String token = register(email);
        client().put().uri("/api/v1/users/me").headers(h -> h.setBearerAuth(token))
                .body(Map.of("currentPassword", "Password123!", "newPassword", "ChangedPassword123!"))
                .retrieve().body(Map.class);
        var revoked = assertThrows(RestClientResponseException.class, () -> client().get().uri("/api/v1/tenant/profile")
                .headers(h -> h.setBearerAuth(token)).retrieve().body(Map.class));
        assertEquals(401, revoked.getStatusCode().value());
        var absent = assertThrows(RestClientResponseException.class, () -> client().get().uri("/api/v1/content/drafts").retrieve().body(List.class));
        assertEquals(401, absent.getStatusCode().value());
    }

    @Test void appearanceCanBeReadAndChangedByAnAuthenticatedUser() {
        String email = UUID.randomUUID() + "@example.test";
        String token = register(email);
        var appearance = client().get().uri("/api/v1/appearance").headers(h -> h.setBearerAuth(token))
                .retrieve().body(Map.class);

        assertNotNull(appearance);
        assertEquals(false, appearance.get("administrator"));
        @SuppressWarnings("unchecked")
        List<String> allowedColors = (List<String>) appearance.get("allowedAccentColors");
        assertNotNull(allowedColors);
        assertFalse(allowedColors.isEmpty());

        String color = allowedColors.contains("blue") ? "blue" : allowedColors.get(0);
        var updated = client().put().uri("/api/v1/users/me/appearance").headers(h -> h.setBearerAuth(token))
                .body(Map.of("accentColor", color)).retrieve().body(Map.class);

        assertNotNull(updated);
        assertEquals(color, updated.get("userAccentColor"));
    }

    @Test void textUsageReportGroupsProviderTokensByTenantLocalDay() {
        String email = UUID.randomUUID() + "@example.test";
        String token = register(email);
        var tenant = users.findByEmailIgnoreCase(email).orElseThrow().getTenant();
        tenant.setTimezone("Asia/Tokyo");
        tenants.save(tenant);

        LocalDateTime limaTimestamp = LocalDateTime.now(ZoneId.of("America/Lima"))
                .withHour(23).withMinute(30).withSecond(0).withNano(0);
        LocalDateTime utcTimestamp = limaTimestamp.atZone(ZoneId.of("America/Lima"))
                .withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        String testProvider = "admin-metrics-test";
        String testModel = "model-" + UUID.randomUUID();
        UUID usageEventId = UUID.randomUUID();
        UUID unreportedEventId = UUID.randomUUID();
        LocalDateTime platformPeriodStartUtc = limaTimestamp.toLocalDate().atStartOfDay(ZoneId.of("America/Lima"))
                .withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        long reportedRequestCountBefore = aiUsageEvents.countReportedTextRequestsSince(platformPeriodStartUtc);
        try {
            jdbc.update("""
                    insert into ai_usage_events
                      (id, tenant_id, provider, model, purpose, input_tokens, output_tokens, total_tokens, created_at)
                    values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    usageEventId, tenant.getId(), testProvider, testModel, "TEXT_GENERATION",
                    240, 120, 360, utcTimestamp);
            jdbc.update("""
                    insert into ai_usage_events
                      (id, tenant_id, provider, model, purpose, input_tokens, output_tokens, total_tokens, created_at)
                    values (?, ?, ?, ?, ?, null, null, null, ?)
                    """,
                    unreportedEventId, tenant.getId(), testProvider, testModel, "TEXT_GENERATION", utcTimestamp);

            var platformDayUsage = aiUsageEvents.summarizeReportedTextTokensByDaySince(
                    limaTimestamp.toLocalDate().atStartOfDay()).stream()
                    .filter(row -> limaTimestamp.toLocalDate().toString().equals(row[0]))
                    .map(row -> ((Number) row[1]).longValue())
                    .mapToLong(Long::longValue)
                    .sum();
            assertEquals(360L, platformDayUsage);
            var modelUsage = aiUsageEvents.summarizeTextUsageByProviderAndModelSince(
                    limaTimestamp.toLocalDate().atStartOfDay(ZoneId.of("America/Lima"))
                            .withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime(),
                    org.springframework.data.domain.PageRequest.of(0, 12));
            var matchingModelUsage = modelUsage.stream()
                    .filter(row -> testProvider.equals(row[0]) && testModel.equals(row[1]))
                    .findFirst().orElseThrow();
            assertEquals(1L, ((Number) matchingModelUsage[2]).longValue());
            assertEquals(240L, ((Number) matchingModelUsage[3]).longValue());
            assertEquals(120L, ((Number) matchingModelUsage[4]).longValue());
            assertEquals(360L, ((Number) matchingModelUsage[5]).longValue());
            assertEquals(reportedRequestCountBefore + 1,
                    aiUsageEvents.countReportedTextRequestsSince(platformPeriodStartUtc));

            var http429Metrics = new com.deyvid.backend.repository.PostgresApiHttp429MetricRepository(jdbc);
            LocalDate metricDate = LocalDate.of(2000, 1, 1);
            assertFalse(http429Metrics.trackingStartedOn().isAfter(LocalDate.now(ZoneId.of("America/Lima"))));
            long http429Before = http429Metrics.countSince(metricDate);
            long aiHttp429Before = http429Metrics.countByDateAndRouteGroupSince(metricDate, metricDate)
                    .getOrDefault(metricDate, Map.of()).getOrDefault("ai", 0L);
            try {
                http429Metrics.increment(metricDate, "ai");
                assertEquals(http429Before + 1, http429Metrics.countSince(metricDate));
                assertEquals(aiHttp429Before + 1, http429Metrics.countByDateAndRouteGroupSince(metricDate, metricDate)
                        .get(metricDate).get("ai"));
            } finally {
                jdbc.update("delete from api_http_429_daily_metrics where metric_date = ? and route_group = ?",
                        metricDate, "ai");
            }

            var apiRequestMetrics = new PostgresApiRequestMetricRepository(jdbc);
            LocalDate requestMetricDate = LocalDate.of(2000, 1, 2);
            long successfulRequestsBefore = apiRequestMetrics.countByDateAndStatusClass(requestMetricDate, requestMetricDate)
                    .getOrDefault(requestMetricDate, Map.of()).getOrDefault(2, 0L);
            try {
                apiRequestMetrics.increment(requestMetricDate, "api", 2);
                assertEquals(successfulRequestsBefore + 1,
                        apiRequestMetrics.countByDateAndStatusClass(requestMetricDate, requestMetricDate)
                                .get(requestMetricDate).get(2));
                assertFalse(apiRequestMetrics.trackingStartedOn().isAfter(LocalDate.now(ZoneId.of("America/Lima"))));
            } finally {
                jdbc.update("delete from api_request_daily_metrics where metric_date = ? and route_group = ? and status_class = ?",
                        requestMetricDate, "api", 2);
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> distribution = client().get().uri("/api/v1/schedules/distribution")
                    .headers(headers -> headers.setBearerAuth(token)).retrieve().body(Map.class);
            @SuppressWarnings("unchecked")
            Map<String, Integer> tokensByDay = (Map<String, Integer>) distribution.get("tokensByDay");
            String expectedTokyoDay = limaTimestamp.atZone(ZoneId.of("America/Lima"))
                    .withZoneSameInstant(ZoneId.of("Asia/Tokyo")).toLocalDate().toString();

            assertEquals(360, tokensByDay.get(expectedTokyoDay));

            LocalDateTime tokyoPeriodStartUtc = LocalDate.parse(expectedTokyoDay)
                    .atStartOfDay(ZoneId.of("Asia/Tokyo"))
                    .withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
            var filteredDailyUsage = aiUsageEvents.summarizeTextUsageByDay(
                    tenant.getId(), tokyoPeriodStartUtc, "Asia/Tokyo");
            assertTrue(filteredDailyUsage.stream()
                    .anyMatch(row -> expectedTokyoDay.equals(row[0]) && ((Number) row[1]).longValue() == 360L));
        } finally {
            jdbc.update("delete from ai_usage_events where id in (?, ?)", usageEventId, unreportedEventId);
        }
    }

    @Test void publicationOutcomeReportGroupsConfirmedAndFailedLogsByDay() {
        String email = UUID.randomUUID() + "@example.test";
        register(email);
        UUID tenantId = users.findByEmailIgnoreCase(email).orElseThrow().getTenant().getId();
        ZoneId limaZone = ZoneId.of("America/Lima");
        LocalDateTime limaFrom = LocalDate.now(limaZone).plusDays(2).atTime(23, 30);
        LocalDateTime from = limaFrom.atZone(limaZone).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        LocalDate day = limaFrom.toLocalDate();
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        UUID third = UUID.randomUUID();
        try {
            jdbc.update("""
                    insert into publication_logs (id, tenant_id, source_mode, status, created_at)
                    values (?, ?, 'PROJECT', ?, ?)
                    """, first, tenantId, "SUCCESS", from);
            jdbc.update("""
                    insert into publication_logs (id, tenant_id, source_mode, status, created_at)
                    values (?, ?, 'PROJECT', ?, ?)
                    """, second, tenantId, "SUCCESS", from.plusMinutes(10));
            jdbc.update("""
                    insert into publication_logs (id, tenant_id, source_mode, status, created_at)
                    values (?, ?, 'PROJECT', ?, ?)
                    """, third, tenantId, "FAILED", from.plusMinutes(20));

            Map<String, Long> counts = new HashMap<>();
            for (Object[] row : publicationLogs.summarizePublicationOutcomesByDaySince(day.atStartOfDay())) {
                if (day.toString().equals(row[0])) {
                    counts.put((String) row[1], ((Number) row[2]).longValue());
                }
            }

            assertEquals(2L, counts.get("SUCCESS"));
            assertEquals(1L, counts.get("FAILED"));
        } finally {
            jdbc.update("delete from publication_logs where id in (?, ?, ?)", first, second, third);
        }
    }

    @Test void imageGenerationReportGroupsByLimaLocalDayAndIgnoresOtherPurposes() {
        String email = UUID.randomUUID() + "@example.test";
        register(email);
        UUID tenantId = users.findByEmailIgnoreCase(email).orElseThrow().getTenant().getId();
        ZoneId limaZone = ZoneId.of("America/Lima");
        LocalDate firstDay = LocalDate.now(limaZone).plusDays(5);
        LocalDate nextDay = firstDay.plusDays(1);
        LocalDateTime from = firstDay.atStartOfDay();
        UUID firstImage = UUID.randomUUID();
        UUID secondImage = UUID.randomUUID();
        UUID nextDayImage = UUID.randomUUID();
        UUID textGeneration = UUID.randomUUID();
        try {
            insertUsageEvent(firstImage, tenantId, "IMAGE_GENERATION",
                    firstDay.atTime(23, 30).atZone(limaZone).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime());
            insertUsageEvent(secondImage, tenantId, "IMAGE_GENERATION",
                    firstDay.atTime(23, 45).atZone(limaZone).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime());
            insertUsageEvent(nextDayImage, tenantId, "IMAGE_GENERATION",
                    nextDay.atTime(0, 15).atZone(limaZone).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime());
            insertUsageEvent(textGeneration, tenantId, "TEXT_GENERATION",
                    firstDay.atTime(23, 40).atZone(limaZone).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime());

            Map<String, Long> countsByLimaDay = new HashMap<>();
            for (Object[] row : aiUsageEvents.summarizeImageGenerationsByDaySince(from)) {
                countsByLimaDay.put((String) row[0], ((Number) row[1]).longValue());
            }

            assertEquals(2L, countsByLimaDay.get(firstDay.toString()));
            assertEquals(1L, countsByLimaDay.get(nextDay.toString()));
        } finally {
            jdbc.update("delete from ai_usage_events where id in (?, ?, ?, ?)",
                    firstImage, secondImage, nextDayImage, textGeneration);
        }
    }

    private void insertUsageEvent(UUID id, UUID tenantId, String purpose, LocalDateTime createdAtUtc) {
        jdbc.update("""
                insert into ai_usage_events (id, tenant_id, provider, model, purpose, created_at)
                values (?, ?, 'audit-test', 'audit-test-model', ?, ?)
                """, id, tenantId, purpose, createdAtUtc);
    }

    @Test void databaseSessionsUseUtcForTimestampStorage() {
        assertEquals("UTC", jdbc.queryForObject("show timezone", String.class));
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
