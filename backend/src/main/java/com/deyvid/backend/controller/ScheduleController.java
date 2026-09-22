package com.deyvid.backend.controller;

import com.deyvid.backend.dto.request.ScheduleRequest;
import com.deyvid.backend.dto.response.ScheduleResponse;
import com.deyvid.backend.entity.PublishingSchedule;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.security.AuthHelper;
import com.deyvid.backend.service.ScheduleManagementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/schedules")
@RequiredArgsConstructor
@Slf4j
public class ScheduleController {

    private final AuthHelper authHelper;
    private final ScheduleManagementService scheduleManagementService;
    private final com.deyvid.backend.service.pipeline.ContentPipelineService contentPipelineService;
    private final com.deyvid.backend.service.AuditLogService auditLogService;
    private final com.deyvid.backend.service.analytics.OptimalPostingTimeService optimalPostingTimeService;
    private final com.deyvid.backend.service.analytics.PostingAnalyticsService postingAnalyticsService;

    @GetMapping("/optimal-status")
    public ResponseEntity<com.deyvid.backend.dto.response.OptimalSlotStatusResponse> getOptimalStatus(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        return ResponseEntity.ok(optimalPostingTimeService.evaluateCurrentPostingSlot(user.getTenant()));
    }

    @GetMapping("/distribution")
    public ResponseEntity<com.deyvid.backend.dto.response.PostingDistributionResponse> getPostingDistribution(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        return ResponseEntity.ok(postingAnalyticsService.getPostingDistribution(user.getTenant()));
    }

    @GetMapping
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<List<ScheduleResponse>> getSchedules(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        List<PublishingSchedule> schedules = scheduleManagementService.getSchedulesByTenant(user.getTenant().getId());

        List<ScheduleResponse> response = schedules.stream()
                .map(this::mapToResponse)
                .toList();

        return ResponseEntity.ok(response);
    }

    @PostMapping
    public ResponseEntity<ScheduleResponse> createSchedule(Authentication auth, @Valid @RequestBody ScheduleRequest request) {
        User user = authHelper.getCurrentUser(auth);
        PublishingSchedule saved = scheduleManagementService.createSchedule(
                user.getTenant(), user.getEmail(), request.cronExpression(), request.description());
        return ResponseEntity.ok(mapToResponse(saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ScheduleResponse> updateSchedule(
            Authentication auth,
            @PathVariable UUID id,
            @Valid @RequestBody ScheduleRequest request) {
        User user = authHelper.getCurrentUser(auth);
        PublishingSchedule updated = scheduleManagementService.updateSchedule(
                id, user.getTenant().getId(), user.getEmail(), request.cronExpression(), request.description());
        return ResponseEntity.ok(mapToResponse(updated));
    }

    @PatchMapping("/{id}/toggle")
    public ResponseEntity<ScheduleResponse> toggleSchedule(Authentication auth, @PathVariable UUID id) {
        User user = authHelper.getCurrentUser(auth);
        PublishingSchedule toggled = scheduleManagementService.toggleSchedule(id, user.getTenant().getId(), user.getEmail());
        return ResponseEntity.ok(mapToResponse(toggled));
    }

    @PostMapping("/{id}/trigger")
    public ResponseEntity<Map<String, Object>> triggerScheduleNow(Authentication auth, @PathVariable UUID id) {
        User user = authHelper.getCurrentUser(auth);
        try {
            contentPipelineService.executePipelineForTenant(user.getTenant().getId());
            auditLogService.recordAction(user.getTenant(), user.getEmail(), "MANUAL_TRIGGER", "Pipeline ejecutado para horario ID: " + id);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "¡Pipeline ejecutado exitosamente! El post fue publicado en las cuentas habilitadas respetando los límites diarios."
            ));
        } catch (Exception e) {
            log.error("Error al ejecutar pipeline para horario {}: {}", id, e.getMessage());
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", "Ejecución finalizada con observación: " + e.getMessage()
            ));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSchedule(Authentication auth, @PathVariable UUID id) {
        User user = authHelper.getCurrentUser(auth);
        scheduleManagementService.deleteSchedule(id, user.getTenant().getId(), user.getEmail());
        return ResponseEntity.noContent().build();
    }

    private ScheduleResponse mapToResponse(PublishingSchedule s) {
        return new ScheduleResponse(s.getId(), s.getCronExpression(), s.getDescription(), s.getIsActive(), s.getCreatedAt());
    }
}
