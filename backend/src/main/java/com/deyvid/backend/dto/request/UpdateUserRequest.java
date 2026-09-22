package com.deyvid.backend.dto.request;

public record UpdateUserRequest(
    String name,
    String currentPassword,
    String newPassword
) {}

