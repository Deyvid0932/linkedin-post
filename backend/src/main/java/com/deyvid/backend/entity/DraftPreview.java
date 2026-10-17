package com.deyvid.backend.entity;

import com.deyvid.backend.entity.enums.SourceMode;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "draft_previews")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DraftPreview {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_mode", nullable = false, length = 20)
    private SourceMode sourceMode;

    @Column(name = "generated_text", columnDefinition = "TEXT")
    private String generatedText;

    @Column(name = "image_url", columnDefinition = "TEXT")
    private String imageUrl;

    @Column(name = "author_urn")
    private String authorUrn;

    @Column(name = "target_credential_id")
    private UUID targetCredentialId;

    @Column(name = "source_reference", columnDefinition = "TEXT")
    private String sourceReference;

    @Builder.Default
    @Column(name = "is_queued", nullable = false)
    private boolean isQueued = false;

    @Builder.Default
    @Column(name = "is_preview", nullable = false)
    private boolean isPreview = false;

    @Column(name = "title", length = 200)
    private String title;

    @Column(name = "tone", length = 40)
    private String tone;

    @Column(name = "audience", length = 200)
    private String audience;

    @Column(name = "goal", length = 40)
    private String goal;

    @Column(name = "instructions", length = 1500)
    private String instructions;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
