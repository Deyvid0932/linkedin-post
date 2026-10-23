package com.deyvid.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "platform_api_quota_settings")
@Getter
@Setter
@NoArgsConstructor
public class PlatformApiQuotaSettings {
    @Id
    private Short id;

    @Column(name = "auth_requests_per_minute", nullable = false)
    private Integer authRequestsPerMinute;

    @Column(name = "ai_requests_per_minute", nullable = false)
    private Integer aiRequestsPerMinute;

    @Column(name = "api_requests_per_minute", nullable = false)
    private Integer apiRequestsPerMinute;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
