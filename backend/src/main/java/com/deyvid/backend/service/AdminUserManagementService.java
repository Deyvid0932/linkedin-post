package com.deyvid.backend.service;

import com.deyvid.backend.dto.response.AdminUserResponse;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.entity.Role;
import com.deyvid.backend.repository.RoleRepository;
import com.deyvid.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.util.UUID;
import java.util.Set;
import java.time.Instant;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminUserManagementService {
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final AuditLogService auditLogService;
    private final ApiQuotaPolicyService apiQuotaPolicyService;

    @Transactional(readOnly = true)
    public Page<AdminUserResponse> findUsers(String search, int page, int size) {
        var pageable = PageRequest.of(Math.max(page, 0), Math.max(1, Math.min(size, 100)));
        String term = search == null ? "" : search.trim();
        if (term.length() > 120) term = term.substring(0, 120);
        Page<User> users = term.isBlank()
                ? userRepository.findAll(pageable)
                : userRepository.findByNameContainingIgnoreCaseOrEmailContainingIgnoreCase(term, term, pageable);
        int platformLimit = apiQuotaPolicyService.currentPolicy().aiRequestsPerMinute();
        return users.map(user -> toResponse(user, platformLimit));
    }

    @Transactional
    public AdminUserResponse setActiveWithResponse(
            UUID administratorId, String administratorEmail, UUID targetUserId, boolean active) {
        return toResponse(setActive(administratorId, administratorEmail, targetUserId, active));
    }

    @Transactional
    public AdminUserResponse setRolesWithResponse(
            UUID administratorId, String administratorEmail, UUID targetUserId, Set<String> roles) {
        return toResponse(setRoles(administratorId, administratorEmail, targetUserId, roles));
    }

    @Transactional
    public AdminUserResponse setAiQuotaWithResponse(
            UUID administratorId, String administratorEmail, UUID targetUserId,
            Integer requestsPerMinute, Instant expiresAt) {
        return toResponse(setAiQuota(administratorId, administratorEmail, targetUserId, requestsPerMinute, expiresAt));
    }

    @Transactional
    public User setActive(UUID administratorId, String administratorEmail, UUID targetUserId, boolean active) {
        User administrator = userRepository.findById(administratorId)
                .orElseThrow(() -> new IllegalArgumentException("Administrador no encontrado"));
        if (administrator.getRoles().stream().noneMatch(role -> "ROLE_ADMIN".equals(role.getName()))) {
            throw new AccessDeniedException("Se requiere el rol de administrador");
        }
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("Cuenta no encontrada"));

        if (!active && administratorId.equals(targetUserId)) {
            throw new IllegalArgumentException("No puedes suspender tu propia cuenta");
        }
        if (Boolean.TRUE.equals(target.getIsActive()) == active) return target;

        boolean targetIsAdmin = target.getRoles().stream().anyMatch(role -> "ROLE_ADMIN".equals(role.getName()));
        if (!active && targetIsAdmin && userRepository.lockActiveUsersWithRole("ROLE_ADMIN").size() <= 1) {
            throw new IllegalArgumentException("No puedes suspender al último administrador activo");
        }

        target.setIsActive(active);
        User saved = userRepository.save(target);
        String action = active ? "ADMIN_USER_REACTIVATED" : "ADMIN_USER_SUSPENDED";
        String details = "Cuenta " + target.getId() + " " + (active ? "reactivada" : "suspendida")
                + " por administración";
        auditLogService.recordAction(administrator.getTenant(), administratorEmail, action, details);
        return saved;
    }

    @Transactional
    public User setRoles(UUID administratorId, String administratorEmail, UUID targetUserId, Set<String> requestedRoles) {
        if (requestedRoles == null || requestedRoles.isEmpty()) {
            throw new IllegalArgumentException("La cuenta debe conservar al menos un rol");
        }
        Set<String> allowedRoles = Set.of("ROLE_ADMIN", "ROLE_DESARROLLADOR", "ROLE_USER");
        if (!allowedRoles.containsAll(requestedRoles)) {
            throw new IllegalArgumentException("Uno o más roles solicitados no están permitidos");
        }
        if (administratorId.equals(targetUserId)) {
            throw new IllegalArgumentException("No puedes cambiar tus propios roles");
        }

        User administrator = userRepository.findById(administratorId)
                .orElseThrow(() -> new IllegalArgumentException("Administrador no encontrado"));
        if (administrator.getRoles().stream().noneMatch(role -> "ROLE_ADMIN".equals(role.getName()))) {
            throw new AccessDeniedException("Se requiere el rol de administrador");
        }
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("Cuenta no encontrada"));
        Set<String> currentRoles = target.getRoles().stream().map(Role::getName).collect(Collectors.toSet());
        if (currentRoles.equals(requestedRoles)) return target;

        boolean removingAdmin = currentRoles.contains("ROLE_ADMIN") && !requestedRoles.contains("ROLE_ADMIN");
        if (removingAdmin && Boolean.TRUE.equals(target.getIsActive())
                && userRepository.lockActiveUsersWithRole("ROLE_ADMIN").size() <= 1) {
            throw new IllegalArgumentException("No puedes quitar el rol al último administrador activo");
        }

        Set<Role> roles = requestedRoles.stream()
                .map(name -> roleRepository.findByName(name)
                        .orElseThrow(() -> new IllegalArgumentException("El rol " + name + " no está configurado")))
                .collect(Collectors.toSet());
        target.setRoles(roles);
        target.setTokenVersion(target.getTokenVersion() + 1);
        User saved = userRepository.save(target);
        auditLogService.recordAction(administrator.getTenant(), administratorEmail, "ADMIN_USER_ROLES_UPDATED",
                "Roles de la cuenta " + target.getId() + " actualizados a " + String.join(", ", requestedRoles));
        return saved;
    }

    @Transactional
    public User setAiQuota(UUID administratorId, String administratorEmail, UUID targetUserId,
                           Integer requestsPerMinute, Instant expiresAt) {
        if (requestsPerMinute != null && (requestsPerMinute < 1 || requestsPerMinute > 120)) {
            throw new IllegalArgumentException("El límite debe estar entre 1 y 120; deja el valor vacío para heredar el límite del espacio");
        }
        if (requestsPerMinute == null && expiresAt != null) {
            throw new IllegalArgumentException("No se puede definir un vencimiento si la cuenta hereda el límite");
        }
        if (expiresAt != null && !expiresAt.isAfter(Instant.now())) {
            throw new IllegalArgumentException("La fecha de vencimiento debe estar en el futuro");
        }
        User administrator = userRepository.findById(administratorId)
                .orElseThrow(() -> new IllegalArgumentException("Administrador no encontrado"));
        if (administrator.getRoles().stream().noneMatch(role -> "ROLE_ADMIN".equals(role.getName()))) {
            throw new AccessDeniedException("Se requiere el rol de administrador");
        }
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("Cuenta no encontrada"));
        if (java.util.Objects.equals(target.getAiRequestsPerMinute(), requestsPerMinute)
                && java.util.Objects.equals(target.getAiRequestsPerMinuteExpiresAt(), expiresAt)) return target;

        target.setAiRequestsPerMinute(requestsPerMinute);
        target.setAiRequestsPerMinuteExpiresAt(requestsPerMinute == null ? null : expiresAt);
        User saved = userRepository.save(target);
        String details = requestsPerMinute == null
                ? "La cuenta " + target.getId() + " vuelve a heredar el límite de IA de su espacio"
                : "Límite personal de IA de la cuenta " + target.getId() + " actualizado a " + requestsPerMinute
                        + " solicitudes por minuto" + (expiresAt == null ? " sin vencimiento" : " hasta " + expiresAt);
        auditLogService.recordAction(target.getTenant(), administratorEmail, "ADMIN_USER_AI_QUOTA_UPDATED", details);
        return saved;
    }

    private AdminUserResponse toResponse(User user, int platformLimit) {
        Set<String> roles = user.getRoles().stream().map(Role::getName).collect(Collectors.toSet());
        Integer tenantOverride = user.getTenant().getAiRequestsPerMinute();
        Instant tenantExpiresAt = user.getTenant().getAiRequestsPerMinuteExpiresAt();
        int tenantLimit = isActiveOverride(tenantOverride, tenantExpiresAt) ? tenantOverride : platformLimit;
        int effectiveUserLimit = isActiveOverride(user.getAiRequestsPerMinute(), user.getAiRequestsPerMinuteExpiresAt())
                ? Math.min(user.getAiRequestsPerMinute(), tenantLimit) : tenantLimit;
        return new AdminUserResponse(user.getId(), user.getTenant().getId(), user.getName(), user.getEmail(),
                Boolean.TRUE.equals(user.getIsActive()), roles, user.getCreatedAt(),
                user.getAiRequestsPerMinute(), user.getAiRequestsPerMinuteExpiresAt(), effectiveUserLimit);
    }

    private AdminUserResponse toResponse(User user) {
        return toResponse(user, apiQuotaPolicyService.currentPolicy().aiRequestsPerMinute());
    }

    private boolean isActiveOverride(Integer override, Instant expiresAt) {
        return override != null && (expiresAt == null || expiresAt.isAfter(Instant.now()));
    }
}
