package com.deyvid.backend.security;

import com.deyvid.backend.service.ApiHttp429MetricService;
import com.deyvid.backend.service.ApiRequestMetricService;
import com.deyvid.backend.service.analytics.ApiRouteGroupClassifier;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 5)
@Slf4j
public class Http429MetricsFilter extends OncePerRequestFilter {
    private final ApiHttp429MetricService metrics;
    private final ApiRequestMetricService requestMetrics;

    public Http429MetricsFilter(ApiHttp429MetricService metrics, ApiRequestMetricService requestMetrics) {
        this.metrics = metrics;
        this.requestMetrics = requestMetrics;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getServletPath();
        if (!path.startsWith("/api/v1/") || "OPTIONS".equals(request.getMethod()) || "/api/v1/health".equals(path)) {
            chain.doFilter(request, response);
            return;
        }

        chain.doFilter(request, response);
        try {
            requestMetrics.record(path, response.getStatus());
        } catch (RuntimeException exception) {
            // Aggregated telemetry must never change the API response.
            log.debug("No se pudo guardar la métrica agregada de solicitudes API");
        }
        if (response.getStatus() == 429) {
            try {
                metrics.record(ApiRouteGroupClassifier.classify(path));
            } catch (RuntimeException exception) {
                // Telemetry must never turn a valid 429 response into a server error.
                log.debug("No se pudo guardar la métrica agregada de respuestas HTTP 429");
            }
        }
    }

}
