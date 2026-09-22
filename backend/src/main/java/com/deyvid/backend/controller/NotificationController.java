package com.deyvid.backend.controller;

import com.deyvid.backend.entity.SystemNotification;
import com.deyvid.backend.security.AuthHelper;
import com.deyvid.backend.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final AuthHelper authHelper;
    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<List<SystemNotification>> getNotifications(Authentication auth) {
        UUID tenantId = authHelper.getCurrentTenantId(auth);
        return ResponseEntity.ok(notificationService.getNotificationsByTenant(tenantId));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<Map<String, Object>> markAsRead(Authentication auth, @PathVariable UUID id) {
        UUID tenantId = authHelper.getCurrentTenantId(auth);
        notificationService.markAsRead(id, tenantId);
        return ResponseEntity.ok(Map.of("message", "Notificación marcada como leída"));
    }

    @PatchMapping("/read-all")
    public ResponseEntity<Map<String, Object>> markAllAsRead(Authentication auth) {
        UUID tenantId = authHelper.getCurrentTenantId(auth);
        notificationService.markAllAsRead(tenantId);
        return ResponseEntity.ok(Map.of("message", "Todas las notificaciones marcadas como leídas"));
    }

    @DeleteMapping("/clear")
    public ResponseEntity<Map<String, Object>> clearAll(Authentication auth) {
        UUID tenantId = authHelper.getCurrentTenantId(auth);
        notificationService.clearAll(tenantId);
        return ResponseEntity.ok(Map.of("message", "Centro de notificaciones vaciado"));
    }
}
