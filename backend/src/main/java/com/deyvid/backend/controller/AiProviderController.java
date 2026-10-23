package com.deyvid.backend.controller;

import com.deyvid.backend.dto.request.AiProviderKeyRequest;
import com.deyvid.backend.dto.response.AiProviderStatusResponse;
import com.deyvid.backend.dto.response.NanoGptImageModelResponse;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.security.AuthHelper;
import com.deyvid.backend.service.TenantAiCredentialService;
import com.deyvid.backend.service.ai.NanoGptImageModels;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/ai-connections")
@RequiredArgsConstructor
public class AiProviderController {
    private final AuthHelper authHelper;
    private final TenantAiCredentialService credentialService;

    @GetMapping
    public ResponseEntity<List<AiProviderStatusResponse>> getStatuses(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        return ResponseEntity.ok(credentialService.statuses(user.getTenant().getId()));
    }

    @GetMapping("/image-models")
    public ResponseEntity<List<NanoGptImageModelResponse>> getImageModels() {
        return ResponseEntity.ok(NanoGptImageModels.catalog().stream()
                .map(option -> new NanoGptImageModelResponse(
                        option.id(), option.name(), option.estimatedPriceUsd()))
                .toList());
    }

    @PutMapping("/{provider}")
    public ResponseEntity<AiProviderStatusResponse> save(
            Authentication auth, @PathVariable String provider, @Valid @RequestBody AiProviderKeyRequest request) {
        User user = authHelper.getCurrentUser(auth);
        return ResponseEntity.ok(credentialService.save(user.getTenant(), provider, request.apiKey(), user.getEmail()));
    }

    @DeleteMapping("/{provider}")
    public ResponseEntity<AiProviderStatusResponse> delete(Authentication auth, @PathVariable String provider) {
        User user = authHelper.getCurrentUser(auth);
        return ResponseEntity.ok(credentialService.delete(user.getTenant(), provider, user.getEmail()));
    }
}
