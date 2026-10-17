package com.deyvid.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "linkedin_oauth_states")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LinkedInOAuthState {
    @Id
    @Column(name = "state_hash", length = 64)
    private String stateHash;

    @Column(name = "browser_hash", nullable = false, length = 64)
    private String browserHash;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;
}
