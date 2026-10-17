package com.deyvid.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "github_linkedin_bindings", uniqueConstraints = {
        @UniqueConstraint(name = "uk_github_linkedin_binding_repo", columnNames = "repository_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class GitHubLinkedInBinding {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "repository_id", nullable = false)
    private GitHubRepository repository;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "linkedin_credential_id", nullable = false)
    private LinkedInCredential linkedInCredential;
    @Column(name = "sync_status", nullable = false, length = 20)
    @Builder.Default private String syncStatus = "PENDING";
    @Column(name = "last_synced_at") private Instant lastSyncedAt;
    @Column(name = "last_error", length = 40) private String lastError;
}
