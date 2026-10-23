package com.deyvid.backend.service;

import com.deyvid.backend.dto.response.AppearanceSettingsResponse;
import com.deyvid.backend.entity.PlatformAppearanceSettings;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.repository.PlatformAppearanceSettingsRepository;
import com.deyvid.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AppearanceService {
    private static final Set<String> SUPPORTED_COLORS = Set.of("red", "blue", "green", "yellow");

    private static final short SETTINGS_ID = 1;
    private final PlatformAppearanceSettingsRepository settingsRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public AppearanceSettingsResponse getSettings(User user) {
        PlatformAppearanceSettings settings = getPlatformSettings();
        List<String> allowed = parseAllowedColors(settings.getAllowedAccentColors());
        String defaultColor = normalizeSupported(settings.getDefaultAccentColor());
        String userColor = user.getAccentColor();
        if (userColor == null || !allowed.contains(userColor)) userColor = defaultColor;
        boolean admin = user.getRoles().stream().anyMatch(role -> "ROLE_ADMIN".equals(role.getName()));
        return new AppearanceSettingsResponse(userColor, defaultColor, allowed, admin);
    }

    @Transactional
    public AppearanceSettingsResponse updateUserAccent(UUID userId, String accentColor) {
        String color = normalizeSupported(accentColor);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
        PlatformAppearanceSettings settings = getPlatformSettings();
        List<String> allowed = parseAllowedColors(settings.getAllowedAccentColors());
        if (!allowed.contains(color)) {
            throw new IllegalArgumentException("Este color no está habilitado por la administración");
        }
        user.setAccentColor(color);
        userRepository.save(user);
        return getSettings(user);
    }

    @Transactional
    public AppearanceSettingsResponse updatePolicy(String defaultColor, List<String> requestedColors) {
        String normalizedDefault = normalizeSupported(defaultColor);
        if (requestedColors == null || requestedColors.isEmpty()) {
            throw new IllegalArgumentException("Debe quedar al menos un color habilitado");
        }
        LinkedHashSet<String> uniqueColors = new LinkedHashSet<>();
        for (String color : requestedColors) uniqueColors.add(normalizeSupported(color));
        if (!uniqueColors.contains(normalizedDefault)) {
            throw new IllegalArgumentException("El color predeterminado debe estar habilitado");
        }
        PlatformAppearanceSettings settings = getPlatformSettings();
        settings.setDefaultAccentColor(normalizedDefault);
        settings.setAllowedAccentColors(String.join(",", uniqueColors));
        settings.setUpdatedAt(java.time.LocalDateTime.now());
        settingsRepository.save(settings);
        return new AppearanceSettingsResponse(normalizedDefault, normalizedDefault, List.copyOf(uniqueColors), true);
    }

    private PlatformAppearanceSettings getPlatformSettings() {
        return settingsRepository.findById(SETTINGS_ID)
                .orElseThrow(() -> new IllegalStateException("No está configurada la paleta de la plataforma"));
    }

    private List<String> parseAllowedColors(String configured) {
        if (configured == null || configured.isBlank()) return List.of("red");
        return Arrays.stream(configured.split(","))
                .map(String::trim)
                .filter(SUPPORTED_COLORS::contains)
                .distinct()
                .toList();
    }

    private String normalizeSupported(String color) {
        if (color == null) throw new IllegalArgumentException("Selecciona un color disponible");
        String normalized = color.trim().toLowerCase(java.util.Locale.ROOT);
        if (!SUPPORTED_COLORS.contains(normalized)) throw new IllegalArgumentException("Color de acento no disponible");
        return normalized;
    }
}
