package com.deyvid.backend.entity;

import com.deyvid.backend.entity.enums.LinkedInAccountType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "linkedin_credentials")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LinkedInCredential {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Enumerated(EnumType.STRING)
    @Column(name = "account_type", nullable = false, length = 30)
    @Builder.Default
    private LinkedInAccountType accountType = LinkedInAccountType.PERSON;

    @Column(name = "author_urn", nullable = false)
    private String authorUrn;

    @Column(name = "person_urn")
    private String personUrn;

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "vanity_name")
    private String vanityName;

    @Column(name = "access_token_enc", nullable = false, columnDefinition = "TEXT")
    private String accessTokenEnc;

    @Column(name = "refresh_token_enc", columnDefinition = "TEXT")
    private String refreshTokenEnc;

    @Column(name = "token_expires_at", nullable = false)
    private LocalDateTime tokenExpiresAt;

    @Column(name = "token_issued_at", nullable = false)
    private LocalDateTime tokenIssuedAt;

    @Column(name = "last_expiration_alert_sent")
    private LocalDateTime lastExpirationAlertSent;

    @Column(name = "is_valid", nullable = false)
    @Builder.Default
    private Boolean isValid = true;

    @Column(name = "is_enabled", nullable = false)
    @Builder.Default
    private Boolean isEnabled = true;

    @Column(name = "is_primary", nullable = false)
    @Builder.Default
    private Boolean isPrimary = false;

    @Column(name = "max_posts_per_day", nullable = false)
    @Builder.Default
    private Integer maxPostsPerDay = 1;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public String getEffectiveAuthorUrn() {
        if (authorUrn != null && !authorUrn.isBlank()) {
            return authorUrn;
        }
        if (personUrn != null && !personUrn.isBlank()) {
            return personUrn;
        }
        return "urn:li:person:me";
    }
}
