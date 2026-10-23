package com.deyvid.backend.controller;

import com.deyvid.backend.dto.request.AppearancePolicyRequest;
import com.deyvid.backend.dto.response.AppearanceSettingsResponse;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.security.AuthHelper;
import com.deyvid.backend.service.AppearanceService;
import com.deyvid.backend.service.AuditLogService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@SpringJUnitConfig(AppearanceControllerAuthorizationTest.MethodSecurityTestConfiguration.class)
class AppearanceControllerAuthorizationTest {
    @Autowired private AppearanceController controller;
    @Autowired private AuthHelper authHelper;
    @Autowired private AppearanceService appearanceService;
    @Autowired private AuditLogService auditLogService;

    @BeforeEach
    void clearMockHistory() {
        clearInvocations(authHelper, appearanceService, auditLogService);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void rejectsPaletteChangesFromRegularUsersBeforeCallingServices() {
        Authentication authentication = authenticate("member", "ROLE_USER");
        AppearancePolicyRequest request = new AppearancePolicyRequest("yellow", List.of("red", "yellow"));

        assertThrows(AccessDeniedException.class,
                () -> controller.updateAppearancePolicy(authentication, request));

        verifyNoInteractions(authHelper, appearanceService, auditLogService);
    }

    @Test
    void permitsAdministratorAndRecordsTheGlobalChange() {
        Authentication authentication = authenticate("admin", "ROLE_ADMIN");
        Tenant tenant = Tenant.builder().id(UUID.randomUUID()).build();
        User administrator = User.builder().tenant(tenant).email("admin@example.test").build();
        AppearancePolicyRequest request = new AppearancePolicyRequest("yellow", List.of("red", "yellow"));
        AppearanceSettingsResponse response = new AppearanceSettingsResponse(
                "red", "yellow", List.of("red", "yellow"), true);
        when(authHelper.getCurrentUser(authentication)).thenReturn(administrator);
        when(appearanceService.getSettings(administrator)).thenReturn(response);

        var result = controller.updateAppearancePolicy(authentication, request);

        assertEquals(response, result.getBody());
        verify(appearanceService).updatePolicy("yellow", List.of("red", "yellow"));
        verify(auditLogService).recordAction(tenant, "admin@example.test", "ADMIN_APPEARANCE_POLICY_UPDATED",
                "Color predeterminado: yellow; colores habilitados: red,yellow");
    }

    private static Authentication authenticate(String username, String role) {
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                username, "test", List.of(new SimpleGrantedAuthority(role)));
        SecurityContextHolder.getContext().setAuthentication(authentication);
        return authentication;
    }

    @Configuration(proxyBeanMethods = false)
    @EnableMethodSecurity
    static class MethodSecurityTestConfiguration {
        @Bean AuthHelper authHelper() { return mock(AuthHelper.class); }
        @Bean AppearanceService appearanceService() { return mock(AppearanceService.class); }
        @Bean AuditLogService auditLogService() { return mock(AuditLogService.class); }
        @Bean AppearanceController appearanceController(
                AuthHelper authHelper, AppearanceService appearanceService, AuditLogService auditLogService) {
            return new AppearanceController(authHelper, appearanceService, auditLogService);
        }
    }
}
