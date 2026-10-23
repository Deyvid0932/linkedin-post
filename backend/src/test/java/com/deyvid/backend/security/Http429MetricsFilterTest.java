package com.deyvid.backend.security;

import com.deyvid.backend.service.ApiHttp429MetricService;
import com.deyvid.backend.service.ApiRequestMetricService;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class Http429MetricsFilterTest {
    @Test
    void recordsOnlyApi429ResponsesAsAnAggregatedRouteGroup() throws Exception {
        List<String> groups = new ArrayList<>();
        Http429MetricsFilter filter = new Http429MetricsFilter(new ApiHttp429MetricService(null) {
            @Override public void record(String routeGroup) { groups.add(routeGroup); }
        }, requestMetricService());

        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request("POST", "/api/v1/insights/daily-suggestion"), response,
                (request, result) -> ((jakarta.servlet.http.HttpServletResponse) result).setStatus(429));
        MockHttpServletResponse success = new MockHttpServletResponse();
        filter.doFilter(request("GET", "/api/v1/users"), success,
                (request, result) -> ((jakarta.servlet.http.HttpServletResponse) result).setStatus(200));

        assertEquals(List.of("ai"), groups);
        assertEquals(429, response.getStatus());
        assertEquals(200, success.getStatus());
    }

    @Test
    void telemetryFailureDoesNotChangeTheRateLimitResponse() throws Exception {
        Http429MetricsFilter filter = new Http429MetricsFilter(new ApiHttp429MetricService(null) {
            @Override public void record(String routeGroup) {
                throw new DataAccessResourceFailureException("database unavailable");
            }
        }, requestMetricService());
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request("GET", "/api/v1/users"), response,
                (request, result) -> ((jakarta.servlet.http.HttpServletResponse) result).setStatus(429));

        assertEquals(429, response.getStatus());
    }

    @Test
    void unexpectedTelemetryRuntimeFailureDoesNotChangeTheRateLimitResponse() throws Exception {
        Http429MetricsFilter filter = new Http429MetricsFilter(new ApiHttp429MetricService(null) {
            @Override public void record(String routeGroup) {
                throw new IllegalArgumentException("invalid metric sink state");
            }
        }, requestMetricService());
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request("POST", "/api/v1/auth/login"), response,
                (request, result) -> ((jakarta.servlet.http.HttpServletResponse) result).setStatus(429));

        assertEquals(429, response.getStatus());
    }

    @Test
    void recordsOnlyStatusClassAndRouteGroupForCompletedApiRequests() throws Exception {
        List<String> requests = new ArrayList<>();
        var requestMetrics = new ApiRequestMetricService(null) {
            @Override public void record(String path, int status) {
                requests.add(path + "#" + status / 100);
            }
        };
        Http429MetricsFilter filter = new Http429MetricsFilter(new ApiHttp429MetricService(null), requestMetrics);

        filter.doFilter(request("POST", "/api/v1/auth/login"), new MockHttpServletResponse(),
                (request, response) -> ((jakarta.servlet.http.HttpServletResponse) response).setStatus(401));
        filter.doFilter(request("GET", "/api/v1/insights/daily-suggestion"), new MockHttpServletResponse(),
                (request, response) -> ((jakarta.servlet.http.HttpServletResponse) response).setStatus(429));
        MockHttpServletRequest privateRequest = request("GET", "/api/v1/users");
        privateRequest.setQueryString("email=private@example.com");
        filter.doFilter(privateRequest, new MockHttpServletResponse(),
                (request, response) -> ((jakarta.servlet.http.HttpServletResponse) response).setStatus(200));
        filter.doFilter(request("OPTIONS", "/api/v1/users"), new MockHttpServletResponse(),
                (request, response) -> ((jakarta.servlet.http.HttpServletResponse) response).setStatus(204));

        assertEquals(List.of("/api/v1/auth/login#4", "/api/v1/insights/daily-suggestion#4", "/api/v1/users#2"), requests);
    }

    @Test
    void requestMetricFailureDoesNotChangeTheApiResponse() throws Exception {
        var requestMetrics = new ApiRequestMetricService(null) {
            @Override public void record(String path, int status) {
                throw new DataAccessResourceFailureException("database unavailable");
            }
        };
        Http429MetricsFilter filter = new Http429MetricsFilter(new ApiHttp429MetricService(null), requestMetrics);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request("GET", "/api/v1/users"), response,
                (request, result) -> ((jakarta.servlet.http.HttpServletResponse) result).setStatus(200));

        assertEquals(200, response.getStatus());
    }

    private static ApiRequestMetricService requestMetricService() {
        return new ApiRequestMetricService(null) {
            @Override public void record(String path, int status) {}
        };
    }

    private static MockHttpServletRequest request(String method, String path) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setServletPath(path);
        return request;
    }
}
