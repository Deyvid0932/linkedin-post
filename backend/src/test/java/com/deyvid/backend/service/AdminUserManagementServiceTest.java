package com.deyvid.backend.service;

import com.deyvid.backend.entity.Role;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.repository.RoleRepository;
import com.deyvid.backend.repository.UserRepository;
import com.deyvid.backend.service.ApiQuotaPolicyService;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdminUserManagementServiceTest {
    @Test
    void preventsAdministratorFromSuspendingSelf() {
        UUID id = UUID.randomUUID();
        User admin = user(id, true, "ROLE_ADMIN");
        Map<UUID, User> records = new HashMap<>(Map.of(id, admin));
        RecordingAuditLog audit = new RecordingAuditLog();
        AdminUserManagementService service = newAdminUserManagementService(records, audit);

        assertThrows(IllegalArgumentException.class, () -> service.setActive(id, "admin@example.com", id, false));
        assertEquals(true, records.get(id).getIsActive());
        assertEquals(null, audit.action);
    }

    @Test
    void suspendsAccountAndRecordsAdministratorAction() {
        UUID adminId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        User admin = user(adminId, true, "ROLE_ADMIN");
        User target = user(targetId, true, "ROLE_USER");
        Map<UUID, User> records = new HashMap<>(Map.of(adminId, admin, targetId, target));
        RecordingAuditLog audit = new RecordingAuditLog();
        AdminUserManagementService service = newAdminUserManagementService(records, audit);

        User result = service.setActive(adminId, "admin@example.com", targetId, false);

        assertEquals(false, result.getIsActive());
        assertEquals("ADMIN_USER_SUSPENDED", audit.action);
        assertEquals("admin@example.com", audit.actor);
        assertEquals(true, audit.details.contains(targetId.toString()));
    }

    @Test
    void updatesRolesInvalidatesExistingSessionsAndRecordsAudit() {
        UUID adminId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        User admin = user(adminId, true, "ROLE_ADMIN");
        User target = user(targetId, true, "ROLE_USER");
        Map<UUID, User> records = new HashMap<>(Map.of(adminId, admin, targetId, target));
        RecordingAuditLog audit = new RecordingAuditLog();
        AdminUserManagementService service = newAdminUserManagementService(records, audit);

        User updated = service.setRoles(adminId, "admin@example.com", targetId, Set.of("ROLE_USER", "ROLE_DESARROLLADOR"));

        assertEquals(Set.of("ROLE_USER", "ROLE_DESARROLLADOR"), updated.getRoles().stream().map(Role::getName).collect(java.util.stream.Collectors.toSet()));
        assertEquals(1, updated.getTokenVersion());
        assertEquals("ADMIN_USER_ROLES_UPDATED", audit.action);
        assertEquals("admin@example.com", audit.actor);
    }

    @Test
    void allowsChangingAnotherAdministratorWhileTheActingAdministratorRemains() {
        UUID adminId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        User admin = user(adminId, true, "ROLE_ADMIN");
        User target = user(targetId, true, "ROLE_ADMIN");
        Map<UUID, User> records = new HashMap<>(Map.of(adminId, admin, targetId, target));
        RecordingAuditLog audit = new RecordingAuditLog();
        AdminUserManagementService service = newAdminUserManagementService(records, audit);

        User updated = service.setRoles(adminId, "admin@example.com", targetId, Set.of("ROLE_USER"));

        assertEquals(Set.of("ROLE_USER"), updated.getRoles().stream().map(Role::getName).collect(java.util.stream.Collectors.toSet()));
        assertEquals(true, admin.getRoles().stream().anyMatch(role -> "ROLE_ADMIN".equals(role.getName())));
        assertEquals("ADMIN_USER_ROLES_UPDATED", audit.action);
    }

    @Test
    void preventsAdministratorFromChangingOwnRoles() {
        UUID adminId = UUID.randomUUID();
        User admin = user(adminId, true, "ROLE_ADMIN");
        Map<UUID, User> records = new HashMap<>(Map.of(adminId, admin));
        RecordingAuditLog audit = new RecordingAuditLog();
        AdminUserManagementService service = newAdminUserManagementService(records, audit);

        assertThrows(IllegalArgumentException.class,
                () -> service.setRoles(adminId, "admin@example.com", adminId, Set.of("ROLE_USER")));
        assertEquals(null, audit.action);
    }

    @Test
    void preventsNonAdministratorFromChangingRoles() {
        UUID userId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        User actor = user(userId, true, "ROLE_USER");
        User target = user(targetId, true, "ROLE_USER");
        Map<UUID, User> records = new HashMap<>(Map.of(userId, actor, targetId, target));
        RecordingAuditLog audit = new RecordingAuditLog();
        AdminUserManagementService service = newAdminUserManagementService(records, audit);

        assertThrows(AccessDeniedException.class,
                () -> service.setRoles(userId, "user@example.com", targetId, Set.of("ROLE_ADMIN")));
        assertEquals(Set.of("ROLE_USER"), target.getRoles().stream().map(Role::getName).collect(java.util.stream.Collectors.toSet()));
        assertEquals(null, audit.action);
    }

    @Test
    void savesPersonalAiQuotaAndAuditsTheOverride() {
        UUID adminId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        User admin = user(adminId, true, "ROLE_ADMIN");
        User target = user(targetId, true, "ROLE_USER");
        target.setTenant(Tenant.builder().id(UUID.randomUUID()).build());
        Map<UUID, User> records = new HashMap<>(Map.of(adminId, admin, targetId, target));
        RecordingAuditLog audit = new RecordingAuditLog();
        AdminUserManagementService service = newAdminUserManagementService(records, audit);

        User saved = service.setAiQuota(adminId, "admin@example.com", targetId, 7, null);

        assertEquals(7, saved.getAiRequestsPerMinute());
        assertEquals("ADMIN_USER_AI_QUOTA_UPDATED", audit.action);
        assertEquals("admin@example.com", audit.actor);
        assertEquals(true, audit.details.contains(targetId.toString()));
    }

    @Test
    void clearsPersonalAiQuotaToRestoreInheritanceAndRejectsOutOfRangeValues() {
        UUID adminId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        User admin = user(adminId, true, "ROLE_ADMIN");
        User target = user(targetId, true, "ROLE_USER");
        target.setTenant(Tenant.builder().id(UUID.randomUUID()).build());
        target.setAiRequestsPerMinute(7);
        Map<UUID, User> records = new HashMap<>(Map.of(adminId, admin, targetId, target));
        RecordingAuditLog audit = new RecordingAuditLog();
        AdminUserManagementService service = newAdminUserManagementService(records, audit);

        User saved = service.setAiQuota(adminId, "admin@example.com", targetId, null, null);
        assertEquals(null, saved.getAiRequestsPerMinute());
        assertEquals("ADMIN_USER_AI_QUOTA_UPDATED", audit.action);
        assertThrows(IllegalArgumentException.class,
                () -> service.setAiQuota(adminId, "admin@example.com", targetId, 121, null));
    }

    @Test
    void storesAnExpiryForTemporaryPersonalQuotaAndAuditsIt() {
        UUID adminId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        User admin = user(adminId, true, "ROLE_ADMIN");
        User target = user(targetId, true, "ROLE_USER");
        target.setTenant(Tenant.builder().id(UUID.randomUUID()).build());
        Map<UUID, User> records = new HashMap<>(Map.of(adminId, admin, targetId, target));
        RecordingAuditLog audit = new RecordingAuditLog();
        AdminUserManagementService service = newAdminUserManagementService(records, audit);
        java.time.Instant expiry = java.time.Instant.now().plusSeconds(3600);

        User saved = service.setAiQuota(adminId, "admin@example.com", targetId, 7, expiry);

        assertEquals(7, saved.getAiRequestsPerMinute());
        assertEquals(expiry, saved.getAiRequestsPerMinuteExpiresAt());
        assertEquals("ADMIN_USER_AI_QUOTA_UPDATED", audit.action);
        assertTrue(audit.details.contains(expiry.toString()));
    }

    private static AdminUserManagementService newAdminUserManagementService(
            Map<UUID, User> records, RecordingAuditLog audit) {
        return new AdminUserManagementService(repository(records), roleRepository(), audit,
                new ApiQuotaPolicyService(null));
    }

    private static UserRepository repository(Map<UUID, User> records) {
        return (UserRepository) Proxy.newProxyInstance(UserRepository.class.getClassLoader(),
                new Class<?>[]{UserRepository.class}, (proxy, method, args) -> switch (method.getName()) {
                    case "findById" -> Optional.ofNullable(records.get((UUID) args[0]));
                    case "countActiveUsersWithRole" -> records.values().stream()
                            .filter(user -> Boolean.TRUE.equals(user.getIsActive()))
                            .filter(user -> user.getRoles().stream().anyMatch(role -> role.getName().equals(args[0])))
                            .count();
                    case "lockActiveUsersWithRole" -> records.values().stream()
                            .filter(user -> Boolean.TRUE.equals(user.getIsActive()))
                            .filter(user -> user.getRoles().stream().anyMatch(role -> role.getName().equals(args[0])))
                            .toList();
                    case "save" -> {
                        User user = (User) args[0];
                        records.put(user.getId(), user);
                        yield user;
                    }
                    case "toString" -> "InMemoryUserRepository";
                    case "hashCode" -> System.identityHashCode(proxy);
                    case "equals" -> proxy == args[0];
                    default -> throw new UnsupportedOperationException("Método no previsto: " + method.getName());
                });
    }

    private static User user(UUID id, boolean active, String roleName) {
        Role role = Role.builder().id(UUID.randomUUID()).name(roleName).build();
        return User.builder().id(id).email(id + "@example.com").name("User")
                .isActive(active).roles(Set.of(role)).build();
    }

    private static RoleRepository roleRepository() {
        Map<String, Role> roles = Map.of(
                "ROLE_ADMIN", Role.builder().id(UUID.randomUUID()).name("ROLE_ADMIN").build(),
                "ROLE_DESARROLLADOR", Role.builder().id(UUID.randomUUID()).name("ROLE_DESARROLLADOR").build(),
                "ROLE_USER", Role.builder().id(UUID.randomUUID()).name("ROLE_USER").build());
        return (RoleRepository) Proxy.newProxyInstance(RoleRepository.class.getClassLoader(),
                new Class<?>[]{RoleRepository.class}, (proxy, method, args) -> switch (method.getName()) {
                    case "findByName" -> Optional.ofNullable(roles.get((String) args[0]));
                    case "toString" -> "InMemoryRoleRepository";
                    case "hashCode" -> System.identityHashCode(proxy);
                    case "equals" -> proxy == args[0];
                    default -> throw new UnsupportedOperationException("Método no previsto: " + method.getName());
                });
    }

    private static final class RecordingAuditLog extends AuditLogService {
        private String actor;
        private String action;
        private String details;

        private RecordingAuditLog() { super(null); }

        @Override
        public void recordAction(Tenant tenant, String userEmail, String action, String details) {
            this.actor = userEmail;
            this.action = action;
            this.details = details;
        }
    }
}

