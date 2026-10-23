package com.deyvid.backend.controller;

import com.deyvid.backend.dto.request.CreateWebhookEndpointRequest;
import com.deyvid.backend.dto.request.WebhookActiveRequest;
import com.deyvid.backend.dto.response.WebhookCreatedResponse;
import com.deyvid.backend.dto.response.WebhookDeliveryResponse;
import com.deyvid.backend.dto.response.WebhookEndpointResponse;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.security.AuthHelper;
import com.deyvid.backend.service.webhook.WebhookDeliveryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/webhooks")
@RequiredArgsConstructor
public class WebhookController {
    private final AuthHelper authHelper;
    private final WebhookDeliveryService webhookService;

    @GetMapping
    public ResponseEntity<List<WebhookEndpointResponse>> list(Authentication auth) {
        return ResponseEntity.ok(webhookService.list(currentUser(auth).getTenant().getId()));
    }

    @PostMapping
    public ResponseEntity<WebhookCreatedResponse> create(
            Authentication auth, @Valid @RequestBody CreateWebhookEndpointRequest request) {
        User user = currentUser(auth);
        return ResponseEntity.ok(webhookService.create(user.getTenant(), user.getEmail(), request));
    }

    @PatchMapping("/{endpointId}/active")
    public ResponseEntity<WebhookEndpointResponse> setActive(
            Authentication auth, @PathVariable UUID endpointId, @Valid @RequestBody WebhookActiveRequest request) {
        User user = currentUser(auth);
        return ResponseEntity.ok(webhookService.setActive(user.getTenant().getId(), user.getEmail(), endpointId, request.active()));
    }

    @DeleteMapping("/{endpointId}")
    public ResponseEntity<Void> delete(Authentication auth, @PathVariable UUID endpointId) {
        User user = currentUser(auth);
        webhookService.delete(user.getTenant().getId(), user.getEmail(), endpointId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{endpointId}/test")
    public ResponseEntity<WebhookDeliveryResponse> test(Authentication auth, @PathVariable UUID endpointId) {
        return ResponseEntity.ok(webhookService.sendTest(currentUser(auth).getTenant(), endpointId));
    }

    @GetMapping("/deliveries")
    public ResponseEntity<Page<WebhookDeliveryResponse>> deliveries(
            Authentication auth, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(webhookService.listDeliveries(currentUser(auth).getTenant().getId(), page, size));
    }

    @PostMapping("/deliveries/{deliveryId}/retry")
    public ResponseEntity<WebhookDeliveryResponse> retry(Authentication auth, @PathVariable UUID deliveryId) {
        return ResponseEntity.ok(webhookService.retry(currentUser(auth).getTenant().getId(), deliveryId));
    }

    private User currentUser(Authentication auth) { return authHelper.getCurrentUser(auth); }
}
