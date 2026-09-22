package com.deyvid.backend.service;

import com.deyvid.backend.entity.AuditLog;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    @Transactional
    public void recordAction(Tenant tenant, String userEmail, String action, String details) {
        try {
            AuditLog auditLog = AuditLog.builder()
                    .tenant(tenant)
                    .userEmail(userEmail != null ? userEmail : "SYSTEM")
                    .action(action)
                    .details(details)
                    .build();
            auditLogRepository.save(auditLog);
            log.info("[AUDIT] Tenant {}: {} ejecutó '{}' - {}", tenant.getId(), userEmail, action, details);
        } catch (Exception e) {
            log.error("Fallo al registrar auditoría: {}", e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public Page<AuditLog> getAuditLogsByTenant(UUID tenantId, Pageable pageable) {
        return auditLogRepository.findByTenantIdOrderByCreatedAtDesc(tenantId, pageable);
    }
}
