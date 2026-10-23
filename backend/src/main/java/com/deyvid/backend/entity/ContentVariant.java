package com.deyvid.backend.entity;

import com.deyvid.backend.dto.request.ContentAdaptRequest;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "content_variants", uniqueConstraints =
        @UniqueConstraint(name = "uk_content_variants_draft_channel", columnNames = {"draft_id", "channel"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContentVariant {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "draft_id", nullable = false)
    private DraftPreview draft;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private ContentAdaptRequest.Channel channel;

    @Column(name = "content_text", nullable = false, columnDefinition = "TEXT")
    private String contentText;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
