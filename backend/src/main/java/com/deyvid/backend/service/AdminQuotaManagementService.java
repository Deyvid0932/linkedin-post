package com.deyvid.backend.service;

import com.deyvid.backend.dto.request.ApiQuotaPolicyRequest;
import com.deyvid.backend.dto.request.TenantAiQuotaRequest;
import com.deyvid.backend.dto.response.ApiQuotaPolicyResponse;
import com.deyvid.backend.dto.response.TenantAiQuotaResponse;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.repository.TenantAiQuotaProjection;
import com.deyvid.backend.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminQuotaManagementService {
    private final TenantRepository tenantRepository;
    private final ApiQuotaPolicyService apiQuotaPolicyService;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public ApiQuotaPolicyResponse getApiQuotaPolicy() {
        return apiQuotaPolicyService.getPolicy();
    }

    @Transactional
    public ApiQuotaPolicyResponse updateApiQuotaPolicy(User administrator, ApiQuotaPolicyRequest request) {
        ApiQuotaPolicyResponse saved = apiQuotaPolicyService.updatePolicy(request);
        auditLogService.recordAction(administrator.getTenant(), administrator.getEmail(), "ADMIN_API_QUOTA_UPDATED",
                "Límites por minuto actualizados: autenticación=" + saved.authRequestsPerMinute()
                        + ", IA=" + saved.aiRequestsPerMinute() + ", API=" + saved.apiRequestsPerMinute());
        return saved;
    }

    @Transactional(readOnly = true)
    public Page<TenantAiQuotaResponse> getTenantAiQuotas(int page, int size) {
        int platformLimit = apiQuotaPolicyService.currentPolicy().aiRequestsPerMinute();
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.max(1, Math.min(size, 100)));
        return tenantRepository.findTenantAiQuotaSummaries(pageable)
                .map(row -> mapTenantQuota(row, platformLimit));
    }

    @Transactional
    public TenantAiQuotaResponse updateTenantAiQuota(User administrator, UUID tenantId, TenantAiQuotaRequest request) {
        validateTenantQuotaRequest(request);
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Espacio de trabajo no encontrado"));
        tenant.setAiRequestsPerMinute(request.requestsPerMinute());
        tenant.setAiRequestsPerMinuteExpiresAt(request.requestsPerMinute() == null ? null : request.expiresAt());
        tenantRepository.save(tenant);

        String description = request.requestsPerMinute() == null
                ? "El espacio vuelve a heredar el límite global de IA"
                : "Límite de IA por espacio actualizado a " + request.requestsPerMinute() + " solicitudes por minuto"
                        + (request.expiresAt() == null ? " sin vencimiento" : " hasta " + request.expiresAt());
        auditLogService.recordAction(tenant, administrator.getEmail(),
                "ADMIN_TENANT_AI_QUOTA_UPDATED", description + " (tenant " + tenantId + ")");

        TenantAiQuotaProjection row = tenantRepository.findTenantAiQuotaById(tenantId)
                .orElseThrow(() -> new IllegalStateException("No se pudo leer el límite actualizado"));
        return mapTenantQuota(row, apiQuotaPolicyService.currentPolicy().aiRequestsPerMinute());
    }

    private void validateTenantQuotaRequest(TenantAiQuotaRequest request) {
        if (request == null || request.requestsPerMinute() == null && request.expiresAt() != null
                || request.requestsPerMinute() != null
                && (request.requestsPerMinute() < 1 || request.requestsPerMinute() > 120)) {
            throw new IllegalArgumentException("El límite debe estar entre 1 y 120; deja el valor vacío para heredar el límite global");
        }
        if (request.expiresAt() != null && !request.expiresAt().isAfter(Instant.now())) {
            throw new IllegalArgumentException("La fecha de vencimiento debe estar en el futuro");
        }
    }

    private TenantAiQuotaResponse mapTenantQuota(TenantAiQuotaProjection row, int platformLimit) {
        Integer override = row.getOverrideRequestsPerMinute();
        boolean active = override != null && (row.getOverrideExpiresAt() == null
                || row.getOverrideExpiresAt().isAfter(Instant.now()));
        return new TenantAiQuotaResponse(row.getTenantId(), row.getPrimaryEmail(), row.getAccountCount(),
                override, row.getOverrideExpiresAt(), active ? override : platformLimit);
    }
}
