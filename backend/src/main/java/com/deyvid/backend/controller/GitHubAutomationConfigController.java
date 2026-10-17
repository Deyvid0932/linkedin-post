package com.deyvid.backend.controller;

import com.deyvid.backend.security.AuthHelper;
import com.deyvid.backend.service.GitHubAutomationConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/automation/github-config")
@RequiredArgsConstructor
public class GitHubAutomationConfigController {
    private final AuthHelper auth;
    private final GitHubAutomationConfigService configs;

    @GetMapping
    public GitHubAutomationConfigService.Config get(Authentication principal, @RequestParam UUID repositoryId) {
        return configs.get(auth.getCurrentTenantId(principal), repositoryId);
    }

    @PutMapping
    public GitHubAutomationConfigService.Config save(Authentication principal, @RequestParam UUID repositoryId,
                                                     @RequestBody GitHubAutomationConfigService.Config config) {
        return configs.save(auth.getCurrentTenantId(principal), repositoryId, config);
    }

    @GetMapping("/review")
    public List<Map<String, Object>> review(Authentication principal, @RequestParam UUID repositoryId) {
        return configs.getPendingReview(auth.getCurrentTenantId(principal), repositoryId);
    }

    @PostMapping("/review/{postId}/approve")
    public Map<String, Object> approve(Authentication principal, @RequestParam UUID repositoryId, @PathVariable String postId) {
        if (!postId.matches("[a-fA-F0-9-]{36}")) throw new IllegalArgumentException("Identificador de borrador inválido");
        return configs.approveReview(auth.getCurrentTenantId(principal), repositoryId, postId);
    }

    @GetMapping("/history")
    public List<Map<String, Object>> history(Authentication principal, @RequestParam UUID repositoryId) {
        return configs.getHistory(auth.getCurrentTenantId(principal), repositoryId);
    }
}
