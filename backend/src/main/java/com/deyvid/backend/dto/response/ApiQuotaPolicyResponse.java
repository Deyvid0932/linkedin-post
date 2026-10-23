package com.deyvid.backend.dto.response;

import java.time.LocalDateTime;

public record ApiQuotaPolicyResponse(
        int authRequestsPerMinute,
        int aiRequestsPerMinute,
        int apiRequestsPerMinute,
        LocalDateTime updatedAt
) {}
