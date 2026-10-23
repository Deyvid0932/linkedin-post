package com.deyvid.backend.controller;

import com.deyvid.backend.dto.request.AppearancePolicyRequest;
import com.deyvid.backend.dto.response.AppearanceSettingsResponse;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.security.AuthHelper;
import com.deyvid.backend.service.AuditLogService;
import com.deyvid.backend.service.AppearanceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/appearance")
@RequiredArgsConstructor
public class AppearanceController {
    private final AuthHelper authHelper;
    private final AppearanceService appearanceService;
    private final AuditLogService auditLogService;

    @GetMapping
    public ResponseEntity<AppearanceSettingsResponse> getAppearance(Authentication auth) {
        return ResponseEntity.ok(appearanceService.getSettings(authHelper.getCurrentUser(auth)));
    }

    @PutMapping("/policy")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AppearanceSettingsResponse> updateAppearancePolicy(
            Authentication auth, @Valid @RequestBody AppearancePolicyRequest request) {
        User user = authHelper.getCurrentUser(auth);
        appearanceService.updatePolicy(request.defaultAccentColor(), request.allowedAccentColors());
        auditLogService.recordAction(user.getTenant(), user.getEmail(), "ADMIN_APPEARANCE_POLICY_UPDATED",
                "Color predeterminado: " + request.defaultAccentColor()
                        + "; colores habilitados: " + String.join(",", request.allowedAccentColors()));
        return ResponseEntity.ok(appearanceService.getSettings(user));
    }
}
