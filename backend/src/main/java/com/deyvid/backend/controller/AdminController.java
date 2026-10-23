package com.deyvid.backend.controller;

import com.deyvid.backend.dto.request.AdminUserRolesRequest;
import com.deyvid.backend.dto.request.AdminUserStatusRequest;
import com.deyvid.backend.dto.request.ApiQuotaPolicyRequest;
import com.deyvid.backend.dto.request.CreateAccountInvitationRequest;
import com.deyvid.backend.dto.request.TenantAiQuotaRequest;
import com.deyvid.backend.dto.request.UserAiQuotaRequest;
import com.deyvid.backend.dto.response.AccountInvitationResponse;
import com.deyvid.backend.dto.response.AdminAuditEventResponse;
import com.deyvid.backend.dto.response.AdminOverviewResponse;
import com.deyvid.backend.dto.response.AdminUserResponse;
import com.deyvid.backend.dto.response.ApiQuotaPolicyResponse;
import com.deyvid.backend.dto.response.CreatedAccountInvitationResponse;
import com.deyvid.backend.dto.response.TenantAiQuotaResponse;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.security.AuthHelper;
import com.deyvid.backend.service.AccountInvitationService;
import com.deyvid.backend.service.AdminAuditQueryService;
import com.deyvid.backend.service.AdminOverviewService;
import com.deyvid.backend.service.AdminQuotaManagementService;
import com.deyvid.backend.service.AdminUserManagementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {
    private final AuthHelper authHelper;
    private final AdminOverviewService adminOverviewService;
    private final AdminUserManagementService adminUserManagementService;
    private final AdminQuotaManagementService adminQuotaManagementService;
    private final AdminAuditQueryService adminAuditQueryService;
    private final AccountInvitationService accountInvitationService;

    @GetMapping("/overview")
    public AdminOverviewResponse getOverview(@RequestParam(defaultValue = "30") int periodDays) {
        return adminOverviewService.getOverview(periodDays);
    }

    @GetMapping("/users")
    public Page<AdminUserResponse> getUsers(
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return adminUserManagementService.findUsers(search, page, size);
    }

    @PatchMapping("/users/{userId}/status")
    public AdminUserResponse updateUserStatus(
            Authentication auth,
            @PathVariable UUID userId,
            @Valid @RequestBody AdminUserStatusRequest request) {
        User administrator = authHelper.getCurrentUser(auth);
        return adminUserManagementService.setActiveWithResponse(
                administrator.getId(), administrator.getEmail(), userId, request.active());
    }

    @PutMapping("/users/{userId}/roles")
    public AdminUserResponse updateUserRoles(
            Authentication auth,
            @PathVariable UUID userId,
            @Valid @RequestBody AdminUserRolesRequest request) {
        User administrator = authHelper.getCurrentUser(auth);
        return adminUserManagementService.setRolesWithResponse(
                administrator.getId(), administrator.getEmail(), userId, request.roles());
    }

    @PutMapping("/users/{userId}/ai-quota")
    public AdminUserResponse updateUserAiQuota(
            Authentication auth,
            @PathVariable UUID userId,
            @Valid @RequestBody UserAiQuotaRequest request) {
        User administrator = authHelper.getCurrentUser(auth);
        return adminUserManagementService.setAiQuotaWithResponse(
                administrator.getId(), administrator.getEmail(), userId,
                request.requestsPerMinute(), request.expiresAt());
    }

    @GetMapping("/invitations")
    public Page<AccountInvitationResponse> getInvitations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return accountInvitationService.list(PageRequest.of(
                Math.max(page, 0), Math.max(1, Math.min(size, 100))));
    }

    @PostMapping("/invitations")
    public CreatedAccountInvitationResponse createInvitation(
            Authentication auth,
            @Valid @RequestBody CreateAccountInvitationRequest request) {
        return accountInvitationService.create(request.email(), authHelper.getCurrentUser(auth));
    }

    @DeleteMapping("/invitations/{invitationId}")
    public AccountInvitationResponse revokeInvitation(Authentication auth, @PathVariable UUID invitationId) {
        return accountInvitationService.revoke(invitationId, authHelper.getCurrentUser(auth));
    }

    @GetMapping("/api-quotas")
    public ApiQuotaPolicyResponse getApiQuotaPolicy() {
        return adminQuotaManagementService.getApiQuotaPolicy();
    }

    @PutMapping("/api-quotas")
    public ApiQuotaPolicyResponse updateApiQuotaPolicy(
            Authentication auth,
            @Valid @RequestBody ApiQuotaPolicyRequest request) {
        return adminQuotaManagementService.updateApiQuotaPolicy(authHelper.getCurrentUser(auth), request);
    }

    @GetMapping("/tenant-ai-quotas")
    public Page<TenantAiQuotaResponse> getTenantAiQuotas(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return adminQuotaManagementService.getTenantAiQuotas(page, size);
    }

    @PutMapping("/tenant-ai-quotas/{tenantId}")
    public TenantAiQuotaResponse updateTenantAiQuota(
            Authentication auth,
            @PathVariable UUID tenantId,
            @Valid @RequestBody TenantAiQuotaRequest request) {
        return adminQuotaManagementService.updateTenantAiQuota(authHelper.getCurrentUser(auth), tenantId, request);
    }

    @GetMapping("/audit-events")
    public Page<AdminAuditEventResponse> getRecentAuditEvents(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return adminAuditQueryService.getRecentEvents(page, size);
    }
}
