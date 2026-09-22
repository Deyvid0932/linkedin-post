package com.deyvid.backend.controller;

import com.deyvid.backend.dto.response.AuditLogResponse;
import com.deyvid.backend.entity.AuditLog;
import com.deyvid.backend.security.AuthHelper;
import com.deyvid.backend.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/audit-logs")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuthHelper authHelper;
    private final AuditLogService auditLogService;

    @GetMapping
    public ResponseEntity<Page<AuditLogResponse>> getAuditLogs(
            Authentication auth,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UUID tenantId = authHelper.getCurrentTenantId(auth);
        Page<AuditLog> logs = auditLogService.getAuditLogsByTenant(tenantId, PageRequest.of(page, size));

        Page<AuditLogResponse> response = logs.map(l -> new AuditLogResponse(
                l.getId(),
                l.getUserEmail(),
                l.getAction(),
                l.getDetails(),
                l.getCreatedAt()
        ));

        return ResponseEntity.ok(response);
    }
}
