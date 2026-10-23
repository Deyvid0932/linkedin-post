package com.deyvid.backend.dto.response;

import java.util.Set;
import java.util.UUID;

public record AuthResponse(
    UUID userId,
    UUID tenantId,
    String name,
    String email,
    Set<String> roles
) {}
