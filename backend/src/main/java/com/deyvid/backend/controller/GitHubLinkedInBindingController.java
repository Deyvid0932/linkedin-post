package com.deyvid.backend.controller;

import com.deyvid.backend.security.AuthHelper;
import com.deyvid.backend.service.GitHubLinkedInBindingService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/automation/github-linkedin-binding")
@RequiredArgsConstructor
public class GitHubLinkedInBindingController {
    private final AuthHelper auth;
    private final GitHubLinkedInBindingService service;
    public record SaveRequest(@NotNull UUID accountId) {}

    @GetMapping
    public GitHubLinkedInBindingService.BindingView get(Authentication principal, @RequestParam UUID repositoryId) {
        return service.get(auth.getCurrentTenantId(principal), repositoryId);
    }
    @PutMapping
    public GitHubLinkedInBindingService.BindingView save(Authentication principal, @RequestParam UUID repositoryId,
                                                          @Valid @RequestBody SaveRequest request) {
        return service.save(auth.getCurrentTenantId(principal), repositoryId, request.accountId());
    }
    @PostMapping("/sync")
    public GitHubLinkedInBindingService.BindingView retry(Authentication principal, @RequestParam UUID repositoryId) {
        return service.retry(auth.getCurrentTenantId(principal), repositoryId);
    }
    @DeleteMapping
    public void disconnect(Authentication principal, @RequestParam UUID repositoryId) {
        service.disconnect(auth.getCurrentTenantId(principal), repositoryId);
    }
}
