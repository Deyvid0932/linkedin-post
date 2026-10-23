package com.deyvid.backend.service;

import com.deyvid.backend.dto.response.PublicationApprovalPolicyResponse;
import com.deyvid.backend.entity.PlatformPublicationPolicy;
import com.deyvid.backend.repository.PlatformPublicationPolicyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class PlatformPublicationPolicyService {
    private static final short POLICY_ID = 1;
    private final PlatformPublicationPolicyRepository repository;

    @Transactional(readOnly = true)
    public PublicationApprovalPolicyResponse getPolicy() {
        PlatformPublicationPolicy policy = repository.findById(POLICY_ID)
                .orElseThrow(() -> new IllegalStateException("No está configurada la política global de publicación"));
        return map(policy);
    }

    @Transactional
    public PublicationApprovalPolicyResponse updatePolicy(boolean approvalRequired) {
        PlatformPublicationPolicy policy = repository.findById(POLICY_ID)
                .orElseThrow(() -> new IllegalStateException("No está configurada la política global de publicación"));
        policy.setApprovalRequired(approvalRequired);
        policy.setUpdatedAt(LocalDateTime.now());
        return map(repository.save(policy));
    }

    /** Resolve both values from one read so the pipeline uses a consistent policy snapshot. */
    @Transactional(readOnly = true)
    public Decision resolve(String tenantMode) {
        boolean approvalRequired = getPolicy().approvalRequired();
        return new Decision(approvalRequired, "AUTOMATIC".equals(tenantMode) && !approvalRequired);
    }

    public record Decision(boolean approvalRequired, boolean automaticPublicationAllowed) {}

    private PublicationApprovalPolicyResponse map(PlatformPublicationPolicy policy) {
        return new PublicationApprovalPolicyResponse(policy.isApprovalRequired(), policy.getUpdatedAt());
    }
}
