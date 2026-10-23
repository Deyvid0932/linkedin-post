package com.deyvid.backend.service;

import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.exception.AiServiceException;
import com.deyvid.backend.security.RequestRateLimitStore;
import com.deyvid.backend.security.UserDetailsServiceImpl;
import org.junit.jupiter.api.Test;
import org.springframework.dao.TransientDataAccessResourceException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TenantAiQuotaServiceTest {
    @Test
    void sharesOverrideBucketAcrossWorkspaceCalls() {
        AtomicReference<String> key = new AtomicReference<>();
        AtomicReference<Integer> limit = new AtomicReference<>();
        RequestRateLimitStore store = new RequestRateLimitStore() {
            @Override public Decision consume(String bucketKey, int limitPerMinute) {
                key.set(bucketKey);
                limit.set(limitPerMinute);
                return new Decision(true, 0);
            }
            @Override public void deleteExpiredBuckets() {}
        };
        UUID tenantId = UUID.randomUUID();
        TenantAiQuotaService service = new TenantAiQuotaService(store, new ApiQuotaPolicyService(null));

        service.consume(Tenant.builder().id(tenantId).aiRequestsPerMinute(18).build());

        assertEquals("tenant-ai:" + tenantId, key.get());
        assertEquals(18, limit.get());
    }

    @Test
    void inheritsPlatformLimitAndRejectsWhenTheWorkspaceBucketIsExhausted() {
        RequestRateLimitStore store = new RequestRateLimitStore() {
            @Override public Decision consume(String bucketKey, int limitPerMinute) {
                assertEquals(10, limitPerMinute);
                return new Decision(false, 0);
            }
            @Override public void deleteExpiredBuckets() {}
        };
        TenantAiQuotaService service = new TenantAiQuotaService(store, new ApiQuotaPolicyService(null));

        AiServiceException error = assertThrows(AiServiceException.class,
                () -> service.consume(Tenant.builder().id(UUID.randomUUID()).build()));
        assertEquals("AI_RATE_LIMIT", error.getErrorCode());
    }

    @Test
    void expiredWorkspaceOverrideFallsBackToPlatformLimit() {
        AtomicReference<Integer> limit = new AtomicReference<>();
        RequestRateLimitStore store = new RequestRateLimitStore() {
            @Override public Decision consume(String bucketKey, int limitPerMinute) {
                limit.set(limitPerMinute);
                return new Decision(true, 0);
            }
            @Override public void deleteExpiredBuckets() {}
        };
        Tenant tenant = Tenant.builder().id(UUID.randomUUID()).aiRequestsPerMinute(30)
                .aiRequestsPerMinuteExpiresAt(java.time.Instant.now().minusSeconds(1)).build();

        new TenantAiQuotaService(store, new ApiQuotaPolicyService(null)).consume(tenant);

        assertEquals(10, limit.get());
    }

    @Test
    void failsClosedWhenPostgresCannotCheckTheWorkspaceQuota() {
        RequestRateLimitStore store = new RequestRateLimitStore() {
            @Override public Decision consume(String bucketKey, int limitPerMinute) {
                throw new TransientDataAccessResourceException("database unavailable");
            }
            @Override public void deleteExpiredBuckets() {}
        };
        TenantAiQuotaService service = new TenantAiQuotaService(store, new ApiQuotaPolicyService(null));

        AiServiceException error = assertThrows(AiServiceException.class,
                () -> service.consume(Tenant.builder().id(UUID.randomUUID()).build()));
        assertEquals("AI_QUOTA_UNAVAILABLE", error.getErrorCode());
    }

    @Test
    void enforcesPersonalAndWorkspaceBudgetsForAuthenticatedUsers() {
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        List<String> keys = new ArrayList<>();
        List<Integer> limits = new ArrayList<>();
        RequestRateLimitStore store = new RequestRateLimitStore() {
            @Override public Decision consume(String bucketKey, int limitPerMinute) {
                keys.add(bucketKey);
                limits.add(limitPerMinute);
                return new Decision(true, 0);
            }
            @Override public void deleteExpiredBuckets() {}
        };
        User user = User.builder().id(userId).email("quota-user@example.test").tenant(Tenant.builder().id(tenantId).build())
                .isActive(true).aiRequestsPerMinute(4).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        new UserDetailsServiceImpl.Principal(user, List.of(new SimpleGrantedAuthority("ROLE_USER"))),
                        null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
        try {
            new TenantAiQuotaService(store, new ApiQuotaPolicyService(null))
                    .consume(Tenant.builder().id(tenantId).aiRequestsPerMinute(8).build());
            assertEquals(List.of("user-ai:" + userId, "tenant-ai:" + tenantId), keys);
            assertEquals(List.of(4, 8), limits);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void personalBudgetCannotExceedWorkspaceBudget() {
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        List<Integer> limits = new ArrayList<>();
        RequestRateLimitStore store = new RequestRateLimitStore() {
            @Override public Decision consume(String bucketKey, int limitPerMinute) {
                limits.add(limitPerMinute);
                return new Decision(true, 0);
            }
            @Override public void deleteExpiredBuckets() {}
        };
        User user = User.builder().id(userId).email("quota-user@example.test").tenant(Tenant.builder().id(tenantId).build())
                .isActive(true).aiRequestsPerMinute(20).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        new UserDetailsServiceImpl.Principal(user, List.of(new SimpleGrantedAuthority("ROLE_USER"))),
                        null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
        try {
            new TenantAiQuotaService(store, new ApiQuotaPolicyService(null))
                    .consume(Tenant.builder().id(tenantId).aiRequestsPerMinute(5).build());
            assertEquals(List.of(5, 5), limits);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void expiredPersonalOverrideUsesTheWorkspaceBucketOnly() {
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        List<String> keys = new ArrayList<>();
        User user = User.builder().id(userId).email("quota-user@example.test").tenant(Tenant.builder().id(tenantId).build())
                .isActive(true).aiRequestsPerMinute(4)
                .aiRequestsPerMinuteExpiresAt(java.time.Instant.now().minusSeconds(1)).build();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserDetailsServiceImpl.Principal(user, List.of(new SimpleGrantedAuthority("ROLE_USER"))),
                null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
        RequestRateLimitStore store = new RequestRateLimitStore() {
            @Override public Decision consume(String bucketKey, int limitPerMinute) {
                keys.add(bucketKey);
                assertEquals(10, limitPerMinute);
                return new Decision(true, 0);
            }
            @Override public void deleteExpiredBuckets() {}
        };
        try {
            new TenantAiQuotaService(store, new ApiQuotaPolicyService(null))
                    .consume(Tenant.builder().id(tenantId).build());
            assertEquals(List.of("tenant-ai:" + tenantId), keys);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
