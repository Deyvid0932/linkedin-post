package com.deyvid.backend.controller;

import com.deyvid.backend.dto.request.QueueUploadRequest;
import com.deyvid.backend.dto.request.QueueScheduleRequest;
import com.deyvid.backend.security.AuthHelper;
import com.deyvid.backend.service.GitHubQueueService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/content/github-queue")
@RequiredArgsConstructor
public class GitHubQueueController {
    private final AuthHelper auth;
    private final GitHubQueueService queues;
    @PostMapping
    public GitHubQueueService.UploadResult upload(Authentication principal, @Valid @RequestBody QueueUploadRequest request) {
        return queues.upload(auth.getCurrentTenantId(principal), request);
    }

    @GetMapping
    public GitHubQueueService.QueueSnapshot list(Authentication principal, @RequestParam UUID repositoryId) {
        return queues.list(auth.getCurrentTenantId(principal), repositoryId);
    }

    @PatchMapping("/{postId}/schedule")
    public GitHubQueueService.ScheduleResult schedule(Authentication principal, @PathVariable UUID postId,
            @RequestParam UUID repositoryId, @Valid @RequestBody QueueScheduleRequest request) {
        return queues.schedule(auth.getCurrentTenantId(principal), repositoryId, postId,
                request.publishAt(), request.timezone(), request.expectedRevision());
    }
}
