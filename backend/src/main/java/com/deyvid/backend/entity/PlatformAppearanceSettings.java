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
@Table(name = "platform_appearance_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlatformAppearanceSettings {
    @Id
    private Short id;

    @Column(name = "default_accent_color", nullable = false, length = 16)
    private String defaultAccentColor;

    @Column(name = "allowed_accent_colors", nullable = false, length = 64)
    private String allowedAccentColors;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
