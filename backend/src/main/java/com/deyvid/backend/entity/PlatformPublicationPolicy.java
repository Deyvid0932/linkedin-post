package com.deyvid.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "platform_publication_policy")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlatformPublicationPolicy {
    @Id
    private Short id;

    @Column(name = "approval_required", nullable = false)
    private boolean approvalRequired;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
