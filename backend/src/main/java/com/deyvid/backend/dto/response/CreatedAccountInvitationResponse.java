package com.deyvid.backend.dto.response;

import java.time.LocalDateTime;
import java.util.UUID;

/** Contains the bearer link only in the response that creates it. */
public record CreatedAccountInvitationResponse(
        UUID id,
        String email,
        String invitationUrl,
        LocalDateTime expiresAt
) {}
