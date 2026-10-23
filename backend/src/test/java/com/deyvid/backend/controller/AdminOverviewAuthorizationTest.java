package com.deyvid.backend.controller;

import com.deyvid.backend.dto.response.AdminOverviewResponse;
import com.deyvid.backend.service.AccountInvitationService;
import com.deyvid.backend.service.AdminAuditQueryService;
import com.deyvid.backend.service.AdminOverviewService;
import com.deyvid.backend.service.AdminQuotaManagementService;
import com.deyvid.backend.service.AdminUserManagementService;
import com.deyvid.backend.security.AuthHelper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@SpringJUnitConfig(AdminOverviewAuthorizationTest.MethodSecurityTestConfiguration.class)
class AdminOverviewAuthorizationTest {
    @Autowired private AdminController controller;
    @Autowired private AdminOverviewService adminOverviewService;
    @Autowired private AuthHelper authHelper;
    @Autowired private AdminUserManagementService adminUserManagementService;
    @Autowired private AdminQuotaManagementService adminQuotaManagementService;
    @Autowired private AdminAuditQueryService adminAuditQueryService;
    @Autowired private AccountInvitationService accountInvitationService;

    @BeforeEach
    void clearMockHistory() {
        clearInvocations(adminOverviewService, authHelper, adminUserManagementService,
                adminQuotaManagementService, adminAuditQueryService, accountInvitationService);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @ParameterizedTest
    @ValueSource(strings = { "ROLE_USER", "ROLE_DESARROLLADOR" })
    void rejectsNonAdministratorsBeforeQueryingAdministrativeMetrics(String role) {
        authenticate("member", role);

        assertThrows(AccessDeniedException.class, () -> controller.getOverview(7));

        verifyNoInteractions(adminOverviewService, authHelper, adminUserManagementService,
                adminQuotaManagementService, adminAuditQueryService, accountInvitationService);
    }

    @Test
    void permitsAdministratorsToLoadTheSelectedMetricsPeriod() {
        authenticate("admin", "ROLE_ADMIN");
        AdminOverviewResponse overview = mock(AdminOverviewResponse.class);
        when(adminOverviewService.getOverview(7)).thenReturn(overview);

        assertEquals(overview, controller.getOverview(7));

        verify(adminOverviewService).getOverview(7);
    }

    private static void authenticate(String username, String role) {
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                username, "test", List.of(new SimpleGrantedAuthority(role)));
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    @Configuration(proxyBeanMethods = false)
    @EnableMethodSecurity
    static class MethodSecurityTestConfiguration {
        @Bean AuthHelper authHelper() { return mock(AuthHelper.class); }
        @Bean AdminOverviewService adminOverviewService() { return mock(AdminOverviewService.class); }
        @Bean AdminUserManagementService adminUserManagementService() { return mock(AdminUserManagementService.class); }
        @Bean AdminQuotaManagementService adminQuotaManagementService() { return mock(AdminQuotaManagementService.class); }
        @Bean AdminAuditQueryService adminAuditQueryService() { return mock(AdminAuditQueryService.class); }
        @Bean AccountInvitationService accountInvitationService() { return mock(AccountInvitationService.class); }
        @Bean AdminController adminController(
                AuthHelper authHelper,
                AdminOverviewService adminOverviewService,
                AdminUserManagementService adminUserManagementService,
                AdminQuotaManagementService adminQuotaManagementService,
                AdminAuditQueryService adminAuditQueryService,
                AccountInvitationService accountInvitationService) {
            return new AdminController(authHelper, adminOverviewService, adminUserManagementService,
                    adminQuotaManagementService, adminAuditQueryService, accountInvitationService);
        }
    }
}
