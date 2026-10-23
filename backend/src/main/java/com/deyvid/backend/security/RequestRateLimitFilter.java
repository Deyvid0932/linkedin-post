package com.deyvid.backend.security;

import com.deyvid.backend.service.ApiQuotaPolicyService;
import com.deyvid.backend.service.analytics.ApiRouteGroupClassifier;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.regex.Pattern;
import java.util.concurrent.atomic.AtomicLong;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
@Slf4j
public class RequestRateLimitFilter extends OncePerRequestFilter {
    private static final long CLEANUP_EVERY_REQUESTS = 512;
    private static final double REFILL_PER_MILLISECOND = 1.0 / 60_000.0;
    private static final Pattern IP_LITERAL = Pattern.compile("[0-9a-fA-F:.]{2,45}");

    private final ApiQuotaPolicyService quotaPolicyService;
    private final RequestRateLimitStore rateLimitStore;
    private final boolean trustForwardedFor;
    private final AtomicLong requests = new AtomicLong();

    public RequestRateLimitFilter(
            ApiQuotaPolicyService quotaPolicyService,
            RequestRateLimitStore rateLimitStore,
            @Value("${app.security.rate-limit.trust-forwarded-for:false}") boolean trustForwardedFor) {
        this.quotaPolicyService = quotaPolicyService;
        this.rateLimitStore = rateLimitStore;
        this.trustForwardedFor = trustForwardedFor;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        String path = req.getServletPath();
        if (!path.startsWith("/api/v1/") || req.getMethod().equals("OPTIONS") || path.equals("/api/v1/health")) {
            chain.doFilter(req, res);
            return;
        }

        String group = ApiRouteGroupClassifier.classify(path);
        String bucketKey = clientAddress(req) + ":" + group;

        if (requests.incrementAndGet() % CLEANUP_EVERY_REQUESTS == 0) {
            try {
                rateLimitStore.deleteExpiredBuckets();
            } catch (DataAccessException exception) {
                log.warn("No se pudieron limpiar las cuotas expiradas de solicitudes");
            }
        }

        final RequestRateLimitStore.Decision decision;
        final int limit;
        try {
            limit = quotaPolicyService.currentPolicy().limitFor(group);
            decision = rateLimitStore.consume(bucketKey, limit);
        } catch (DataAccessException exception) {
            log.warn("No se pudo verificar la cuota de una solicitud API");
            rejectUnavailable(res);
            return;
        }

        if (!decision.allowed()) {
            long retryAfterSeconds = Math.max(1,
                    (long) Math.ceil((1.0 - decision.remainingTokens()) / (limit * REFILL_PER_MILLISECOND) / 1000.0));
            reject(res, retryAfterSeconds);
            return;
        }
        chain.doFilter(req, res);
    }

    private String clientAddress(HttpServletRequest request) {
        if (trustForwardedFor) {
            String forwardedFor = request.getHeader("X-Forwarded-For");
            if (forwardedFor != null) {
                String candidate = forwardedFor.trim();
                if (IP_LITERAL.matcher(candidate).matches()) return candidate;
            }
        }
        return String.valueOf(request.getRemoteAddr());
    }

    private void reject(HttpServletResponse res, long retryAfterSeconds) throws IOException {
        res.setStatus(429);
        res.setHeader("Retry-After", Long.toString(retryAfterSeconds));
        res.setContentType("application/json");
        res.setCharacterEncoding("UTF-8");
        res.getWriter().write("{\"message\":\"Demasiadas solicitudes. Espera un minuto e intenta de nuevo.\"}");
    }

    private void rejectUnavailable(HttpServletResponse res) throws IOException {
        res.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
        res.setHeader("Retry-After", "30");
        res.setContentType("application/json");
        res.setCharacterEncoding("UTF-8");
        res.getWriter().write("{\"message\":\"No se pudo verificar el límite de solicitudes. Intenta más tarde.\"}");
    }
}
