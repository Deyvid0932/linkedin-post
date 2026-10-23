package com.deyvid.backend.service;

import com.deyvid.backend.entity.AccountInvitation;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.repository.AccountInvitationRepository;
import com.deyvid.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AccountInvitationServiceTest {
    @Mock private AccountInvitationRepository invitationRepository;
    @Mock private UserRepository userRepository;
    @Mock private TenantService tenantService;
    @Mock private AuditLogService auditLogService;
    @InjectMocks private AccountInvitationService service;

    @BeforeEach
    void configureFrontendUrl() {
        ReflectionTestUtils.setField(service, "frontendBaseUrl", "https://autopost.example.com/");
    }

    @Test
    void createsHashedSingleUseInvitationAndAcceptsItOnlyOnce() {
        User admin = User.builder().id(UUID.randomUUID()).email("admin@example.com")
                .tenant(Tenant.builder().id(UUID.randomUUID()).build()).build();
        when(userRepository.existsByEmailIgnoreCase("person@example.com")).thenReturn(false);
        when(invitationRepository.findFirstByEmailIgnoreCaseAndAcceptedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc("person@example.com"))
                .thenReturn(Optional.empty());
        when(invitationRepository.save(any(AccountInvitation.class))).thenAnswer(invocation -> {
            AccountInvitation value = invocation.getArgument(0);
            if (value.getId() == null) value.setId(UUID.randomUUID());
            return value;
        });

        var created = service.create(" Person@Example.com ", admin);

        String token = URLDecoder.decode(created.invitationUrl().substring(created.invitationUrl().indexOf("#token=") + 7), StandardCharsets.UTF_8);
        assertTrue(created.invitationUrl().startsWith("https://autopost.example.com/auth/accept-invitation#token="));
        assertEquals(43, token.length());
        ArgumentCaptor<AccountInvitation> stored = ArgumentCaptor.forClass(AccountInvitation.class);
        verify(invitationRepository).save(stored.capture());
        AccountInvitation invitation = stored.getValue();
        assertNotEquals(token, invitation.getTokenHash());
        assertEquals(64, invitation.getTokenHash().length());
        assertEquals("person@example.com", invitation.getEmail());

        when(invitationRepository.findByTokenHashForUpdate(invitation.getTokenHash())).thenReturn(Optional.of(invitation));
        when(userRepository.existsByEmailIgnoreCase("person@example.com")).thenReturn(false);
        User acceptedUser = User.builder().email("person@example.com").tenant(Tenant.builder().id(UUID.randomUUID()).build()).build();
        when(tenantService.registerUserAndTenant("Persona", "person@example.com", "password-long")).thenReturn(acceptedUser);

        assertEquals("person@example.com", service.accept(token, " Persona ", "password-long"));
        assertNotNull(invitation.getAcceptedAt());
        assertThrows(IllegalArgumentException.class, () -> service.accept(token, "Persona", "password-long"));
        verify(tenantService, times(1)).registerUserAndTenant("Persona", "person@example.com", "password-long");
        verify(auditLogService).recordAction(admin.getTenant(), admin.getEmail(),
                "ADMIN_INVITATION_CREATED", "Invitación de cuenta creada para person@example.com");
    }

    @Test
    void rejectsExpiredInvitationWithoutCreatingAccount() {
        String token = "A".repeat(43);
        AccountInvitation expired = AccountInvitation.builder().id(UUID.randomUUID())
                .email("person@example.com").tokenHash("unused")
                .expiresAt(LocalDateTime.now().minusSeconds(1)).build();
        when(invitationRepository.findByTokenHashForUpdate(anyString())).thenReturn(Optional.of(expired));

        assertThrows(IllegalArgumentException.class, () -> service.accept(token, "Persona", "password-long"));
        verifyNoInteractions(tenantService);
        verify(invitationRepository, never()).save(any(AccountInvitation.class));
    }
}
