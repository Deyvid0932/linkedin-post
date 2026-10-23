package com.deyvid.backend.security;

import com.deyvid.backend.service.ApiQuotaPolicyService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.dao.DataAccessResourceFailureException;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RequestRateLimitFilterTest {
    @Test
    void appliesTheAiQuotaToOnDemandDailySuggestions() throws ServletException, IOException {
        InMemoryRateLimitStore store = new InMemoryRateLimitStore();
        RequestRateLimitFilter filter = filter(store);
        AtomicInteger passed = new AtomicInteger();
        FilterChain chain = (request, response) -> passed.incrementAndGet();
        MockHttpServletResponse lastResponse = null;

        for (int attempt = 0; attempt < 11; attempt++) {
            MockHttpServletRequest request = request("POST", "/api/v1/insights/daily-suggestion", "192.0.2.89");
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request, response, chain);
            lastResponse = response;
        }

        assertEquals(10, passed.get());
        assertEquals(429, lastResponse.getStatus());
    }

    @Test
    void sharesTheApiQuotaAcrossFilterInstancesUsingTheSameStore() throws ServletException, IOException {
        InMemoryRateLimitStore sharedStore = new InMemoryRateLimitStore();
        RequestRateLimitFilter firstInstance = filter(sharedStore);
        RequestRateLimitFilter secondInstance = filter(sharedStore);
        AtomicInteger passed = new AtomicInteger();
        FilterChain chain = (request, response) -> passed.incrementAndGet();
        MockHttpServletResponse lastResponse = null;

        for (int attempt = 0; attempt < 121; attempt++) {
            RequestRateLimitFilter instance = attempt % 2 == 0 ? firstInstance : secondInstance;
            MockHttpServletResponse response = new MockHttpServletResponse();
            instance.doFilter(request("GET", "/api/v1/users", "192.0.2.88"), response, chain);
            lastResponse = response;
        }

        assertEquals(120, passed.get());
        assertEquals(429, lastResponse.getStatus());
        assertTrue(Long.parseLong(lastResponse.getHeader("Retry-After")) >= 1);
    }

    @Test
    void ignoresClientSuppliedForwardedAddressesWhenChoosingTheQuotaBucket() throws ServletException, IOException {
        InMemoryRateLimitStore store = new InMemoryRateLimitStore();
        RequestRateLimitFilter filter = filter(store);
        AtomicInteger passed = new AtomicInteger();
        FilterChain chain = (request, response) -> passed.incrementAndGet();

        for (int attempt = 0; attempt < 11; attempt++) {
            MockHttpServletRequest request = request("POST", "/api/v1/insights/daily-suggestion", "192.0.2.89");
            request.addHeader("X-Forwarded-For", "198.51.100." + attempt);
            filter.doFilter(request, new MockHttpServletResponse(), chain);
        }

        assertEquals(10, passed.get());
    }

    @Test
    void usesTheForwardedClientIpOnlyWhenTheReverseProxyIsExplicitlyTrusted() throws ServletException, IOException {
        RequestRateLimitFilter filter = filter(new InMemoryRateLimitStore(), true);
        AtomicInteger passed = new AtomicInteger();
        FilterChain chain = (request, response) -> passed.incrementAndGet();

        for (int attempt = 0; attempt < 20; attempt++) {
            MockHttpServletRequest request = request("POST", "/api/v1/insights/daily-suggestion", "172.30.0.10");
            request.addHeader("X-Forwarded-For", attempt % 2 == 0 ? "192.0.2.1" : "192.0.2.2");
            filter.doFilter(request, new MockHttpServletResponse(), chain);
        }

        assertEquals(20, passed.get());
    }

    @Test
    void rejectsForwardedChainsInsteadOfTrustingAnUnnormalizedHeader() throws ServletException, IOException {
        RequestRateLimitFilter filter = filter(new InMemoryRateLimitStore(), true);
        AtomicInteger passed = new AtomicInteger();
        FilterChain chain = (request, response) -> passed.incrementAndGet();

        for (int attempt = 0; attempt < 11; attempt++) {
            MockHttpServletRequest request = request("POST", "/api/v1/insights/daily-suggestion", "172.30.0.10");
            request.addHeader("X-Forwarded-For", "192.0.2." + attempt + ", 198.51.100.9");
            filter.doFilter(request, new MockHttpServletResponse(), chain);
        }

        assertEquals(10, passed.get());
    }

    @Test
    void failsClosedWithServiceUnavailableWhenTheQuotaStoreCannotBeReached() throws ServletException, IOException {
        RequestRateLimitStore unavailableStore = new RequestRateLimitStore() {
            @Override
            public Decision consume(String bucketKey, int limitPerMinute) {
                throw new DataAccessResourceFailureException("database unavailable");
            }

            @Override
            public void deleteExpiredBuckets() {}
        };
        RequestRateLimitFilter filter = filter(unavailableStore);
        AtomicInteger passed = new AtomicInteger();
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request("GET", "/api/v1/users", "192.0.2.77"), response,
                (request, result) -> passed.incrementAndGet());

        assertEquals(503, response.getStatus());
        assertEquals("30", response.getHeader("Retry-After"));
        assertEquals(0, passed.get());
    }

    private static RequestRateLimitFilter filter(RequestRateLimitStore store) {
        return filter(store, false);
    }

    private static RequestRateLimitFilter filter(RequestRateLimitStore store, boolean trustForwardedFor) {
        return new RequestRateLimitFilter(new ApiQuotaPolicyService(null), store, trustForwardedFor);
    }

    private static MockHttpServletRequest request(String method, String path, String address) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setServletPath(path);
        request.setRemoteAddr(address);
        return request;
    }

    private static final class InMemoryRateLimitStore implements RequestRateLimitStore {
        private record Bucket(double tokens, long refilledAt, long lastSeen) {}
        private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

        @Override
        public Decision consume(String bucketKey, int limitPerMinute) {
            long now = System.currentTimeMillis();
            AtomicDecision decision = new AtomicDecision();
            buckets.compute(bucketKey, (key, previous) -> {
                double available = previous == null ? limitPerMinute
                        : Math.min(limitPerMinute, previous.tokens()
                                + Math.max(0, now - previous.refilledAt()) * limitPerMinute / 60_000.0);
                boolean allowed = available >= 1;
                double remaining = allowed ? available - 1 : available;
                decision.value = new Decision(allowed, remaining);
                return new Bucket(remaining, now, now);
            });
            return decision.value;
        }

        @Override
        public void deleteExpiredBuckets() {
            long threshold = System.currentTimeMillis() - 120_000;
            buckets.entrySet().removeIf(entry -> entry.getValue().lastSeen() < threshold);
        }

        private static final class AtomicDecision { private Decision value; }
    }
}
