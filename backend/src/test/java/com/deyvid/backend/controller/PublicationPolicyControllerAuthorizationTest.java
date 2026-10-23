package com.deyvid.backend.controller;

import com.deyvid.backend.config.SecurityConfig;
import com.deyvid.backend.dto.request.PublicationApprovalPolicyRequest;
import com.deyvid.backend.dto.response.PublicationApprovalPolicyResponse;
import com.deyvid.backend.entity.AuditLog;
import com.deyvid.backend.entity.PlatformPublicationPolicy;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.repository.AuditLogRepository;
import com.deyvid.backend.repository.PlatformPublicationPolicyRepository;
import com.deyvid.backend.repository.UserRepository;
import com.deyvid.backend.security.AuthHelper;
import com.deyvid.backend.service.AuditLogService;
import com.deyvid.backend.service.PlatformPublicationPolicyService;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

import java.lang.reflect.Proxy;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PublicationPolicyControllerAuthorizationTest {
    @Test
    void endpointIsProtectedByAdminMethodSecurity() {
        PreAuthorize access = PublicationPolicyController.class.getAnnotation(PreAuthorize.class);

        assertTrue(SecurityConfig.class.isAnnotationPresent(EnableMethodSecurity.class));
        assertEquals("hasRole('ADMIN')", access.value());
    }

    @Test
    void administratorChangeUpdatesPolicyAndWritesAuditEvent() {
        Tenant tenant = Tenant.builder().id(UUID.randomUUID()).build();
        User administrator = User.builder().tenant(tenant).email("admin@example.test").build();
        AtomicReference<PlatformPublicationPolicy> policy = new AtomicReference<>(PlatformPublicationPolicy.builder()
                .id((short) 1).approvalRequired(false).updatedAt(LocalDateTime.now()).build());
        AtomicReference<AuditLog> audit = new AtomicReference<>();

        UserRepository users = proxy(UserRepository.class, (method, args) -> {
            if (method.equals("findByEmailIgnoreCase")) return Optional.of(administrator);
            throw new UnsupportedOperationException(method);
        });
        PlatformPublicationPolicyRepository policies = proxy(PlatformPublicationPolicyRepository.class,
                (method, args) -> {
                    if (method.equals("findById")) return Optional.of(policy.get());
                    if (method.equals("save")) {
                        policy.set((PlatformPublicationPolicy) args[0]);
                        return args[0];
                    }
                    throw new UnsupportedOperationException(method);
                });
        AuditLogRepository audits = proxy(AuditLogRepository.class, (method, args) -> {
            if (method.equals("save")) {
                audit.set((AuditLog) args[0]);
                return args[0];
            }
            throw new UnsupportedOperationException(method);
        });
        PublicationPolicyController controller = new PublicationPolicyController(
                new PlatformPublicationPolicyService(policies), new AuthHelper(users), new AuditLogService(audits));
        var authentication = new UsernamePasswordAuthenticationToken("admin@example.test", "test",
                List.of());

        PublicationApprovalPolicyResponse response = controller.updatePolicy(authentication,
                new PublicationApprovalPolicyRequest(true));

        assertTrue(response.approvalRequired());
        assertTrue(policy.get().isApprovalRequired());
        assertEquals("ADMIN_PUBLICATION_APPROVAL_POLICY_UPDATED", audit.get().getAction());
        assertEquals("admin@example.test", audit.get().getUserEmail());
        assertEquals(tenant, audit.get().getTenant());
    }

    private static <T> T proxy(Class<T> type, RepositoryCall call) {
        return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type},
                (instance, method, args) -> {
                    if (method.getDeclaringClass() == Object.class) {
                        return switch (method.getName()) {
                            case "toString" -> type.getSimpleName() + " test proxy";
                            case "hashCode" -> System.identityHashCode(instance);
                            case "equals" -> instance == args[0];
                            default -> throw new UnsupportedOperationException(method.getName());
                        };
                    }
                    return call.invoke(method.getName(), args);
                }));
    }

    @FunctionalInterface
    private interface RepositoryCall {
        Object invoke(String method, Object[] args) throws Throwable;
    }
}
