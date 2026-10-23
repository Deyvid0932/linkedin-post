package com.deyvid.backend.dto.response;

import java.time.LocalDateTime;

public record PublicationApprovalPolicyResponse(boolean approvalRequired, LocalDateTime updatedAt) {}
