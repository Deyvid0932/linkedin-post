package com.deyvid.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "tenants")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Tenant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "system_prompt", columnDefinition = "TEXT")
    private String systemPrompt;

    @Column(name = "timezone", nullable = false, length = 50)
    @Builder.Default
    private String timezone = "America/Lima";

    @Column(name = "app_approval_mode", nullable = false, length = 24)
    @Builder.Default
    private String appApprovalMode = "REQUIRE_APPROVAL";

    @Column(name = "app_target_characters", nullable = false)
    @Builder.Default
    private Integer appTargetCharacters = 1200;

    @Column(name = "app_image_model", nullable = false, length = 80)
    @Builder.Default
      private String appImageModel = "qwen-image-2.1/text-to-image";

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "is_emergency_paused")
    @Builder.Default
    private Boolean isEmergencyPaused = false;

    @Column(name = "is_dry_run")
    @Builder.Default
    private Boolean isDryRun = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
