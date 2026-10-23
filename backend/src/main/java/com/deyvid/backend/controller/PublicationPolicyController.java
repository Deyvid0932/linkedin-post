package com.deyvid.backend.controller;

import com.deyvid.backend.dto.request.PublicationApprovalPolicyRequest;
import com.deyvid.backend.dto.response.PublicationApprovalPolicyResponse;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.security.AuthHelper;
import com.deyvid.backend.service.AuditLogService;
import com.deyvid.backend.service.PlatformPublicationPolicyService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/publication-policy")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class PublicationPolicyController {
    private final PlatformPublicationPolicyService policyService;
    private final AuthHelper authHelper;
    private final AuditLogService auditLogService;

    @GetMapping
    public PublicationApprovalPolicyResponse getPolicy() {
        return policyService.getPolicy();
    }

    @PutMapping
    public PublicationApprovalPolicyResponse updatePolicy(
            Authentication authentication,
            @RequestBody PublicationApprovalPolicyRequest request) {
        if (request == null) throw new IllegalArgumentException("Indica la política de aprobación");
        User administrator = authHelper.getCurrentUser(authentication);
        PublicationApprovalPolicyResponse saved = policyService.updatePolicy(request.approvalRequired());
        auditLogService.recordAction(administrator.getTenant(), administrator.getEmail(),
                "ADMIN_PUBLICATION_APPROVAL_POLICY_UPDATED",
                saved.approvalRequired()
                        ? "La administración exige aprobación antes de la publicación automática"
                        : "La aprobación global es opcional; cada espacio puede elegir su modo");
        return saved;
    }
}
