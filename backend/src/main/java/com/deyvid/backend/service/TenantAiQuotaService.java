package com.deyvid.backend.service;

import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.exception.AiServiceException;
import com.deyvid.backend.security.RequestRateLimitStore;
import com.deyvid.backend.security.UserDetailsServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataAccessException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import java.time.Instant;

/** Enforces a shared, PostgreSQL-backed AI request budget for every user in a workspace. */
@Service
@RequiredArgsConstructor
public class TenantAiQuotaService {
    private final RequestRateLimitStore store;
    private final ApiQuotaPolicyService platformPolicy;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void consume(Tenant tenant) {
        if (tenant == null || tenant.getId() == null) return;
        try {
            int platformLimit = platformPolicy.currentPolicy().aiRequestsPerMinute();
            int tenantLimit = isActiveOverride(tenant.getAiRequestsPerMinute(), tenant.getAiRequestsPerMinuteExpiresAt())
                    ? tenant.getAiRequestsPerMinute()
                    : platformLimit;
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()
                    && authentication.getPrincipal() instanceof UserDetailsServiceImpl.Principal principal
                    && principal.getUserId() != null) {
                if (!tenant.getId().equals(principal.getTenantId())) {
                    throw new AccessDeniedException("El usuario no pertenece al espacio de trabajo de esta solicitud");
                }
                Integer userOverride = principal.getAiRequestsPerMinute();
                if (isActiveOverride(userOverride, principal.getAiRequestsPerMinuteExpiresAt())) {
                    int userLimit = Math.min(userOverride, tenantLimit);
                    RequestRateLimitStore.Decision userDecision = store.consume("user-ai:" + principal.getUserId(), userLimit);
                    if (!userDecision.allowed()) {
                        throw new AiServiceException("AI_RATE_LIMIT",
                                "Esta cuenta alcanzó su límite personal de solicitudes de IA por minuto. Espera un momento e inténtalo de nuevo.");
                    }
                }
            }
            RequestRateLimitStore.Decision decision = store.consume("tenant-ai:" + tenant.getId(), tenantLimit);
            if (!decision.allowed()) {
                throw new AiServiceException("AI_RATE_LIMIT",
                        "Este espacio alcanzó su límite de solicitudes de IA por minuto. Espera un momento e inténtalo de nuevo.");
            }
        } catch (DataAccessException exception) {
            throw new AiServiceException("AI_QUOTA_UNAVAILABLE",
                    "No se pudo verificar el límite de IA del espacio. Inténtalo de nuevo más tarde.", exception);
        }
    }

    private boolean isActiveOverride(Integer limit, Instant expiresAt) {
        return limit != null && (expiresAt == null || expiresAt.isAfter(Instant.now()));
    }
}
