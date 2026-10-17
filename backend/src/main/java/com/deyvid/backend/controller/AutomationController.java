package com.deyvid.backend.controller;

import com.deyvid.backend.service.AutomationService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/v1/automation")
public class AutomationController {
    private final AutomationService automation;
    private final String token;
    private final String tenantId;
    private final String mode;

    public AutomationController(AutomationService automation, @Value("${app.automation.token:}") String token,
                                @Value("${app.automation.tenant-id:}") String tenantId,
                                @Value("${app.scheduler.mode:quartz}") String mode) {
        this.automation = automation; this.token = token; this.tenantId = tenantId; this.mode = mode;
    }

    @PostMapping("/run-due")
    public ResponseEntity<?> run(@RequestHeader(value = "Authorization", defaultValue = "") String authorization) {
        if (!mode.equals("actions") || token.length() < 32 || tenantId.isBlank()) return ResponseEntity.status(503).body(Map.of("message", "Automatización externa no configurada"));
        if (!MessageDigest.isEqual(("Bearer " + token).getBytes(StandardCharsets.UTF_8), authorization.getBytes(StandardCharsets.UTF_8))) {
            return ResponseEntity.status(401).body(Map.of("message", "No autorizado"));
        }
        return ResponseEntity.ok(automation.runDue(UUID.fromString(tenantId), Instant.now()));
    }
}
