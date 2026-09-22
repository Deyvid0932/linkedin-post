package com.deyvid.backend.dto.response;

import java.util.Set;
import java.util.UUID;

public record AuthResponse(
    String token,
    String type,
    UUID userId,
    UUID tenantId,
    String name,
    String email,
    Set<String> roles
) {
    public AuthResponse(String token, UUID userId, UUID tenantId, String name, String email, Set<String> roles) {
        this(token, "Bearer", userId, tenantId, name, email, roles);
    }
}
