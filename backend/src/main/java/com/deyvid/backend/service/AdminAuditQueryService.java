package com.deyvid.backend.service;

import com.deyvid.backend.dto.response.AdminAuditEventResponse;
import com.deyvid.backend.entity.AuditLog;
import com.deyvid.backend.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminAuditQueryService {
    private final AuditLogRepository auditLogRepository;

    @Transactional(readOnly = true)
    public Page<AdminAuditEventResponse> getRecentEvents(int page, int size) {
        return auditLogRepository.findAllByOrderByCreatedAtDesc(pageRequest(page, size)).map(this::toResponse);
    }

    private PageRequest pageRequest(int page, int size) {
        return PageRequest.of(Math.max(page, 0), Math.max(1, Math.min(size, 100)));
    }

    private AdminAuditEventResponse toResponse(AuditLog event) {
        UUID tenantId = event.getTenant() == null ? null : event.getTenant().getId();
        return new AdminAuditEventResponse(event.getId(), tenantId, event.getUserEmail(),
                event.getAction(), event.getCreatedAt());
    }
}
