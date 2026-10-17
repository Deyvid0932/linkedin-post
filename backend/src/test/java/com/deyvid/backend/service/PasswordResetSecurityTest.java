package com.deyvid.backend.service;

import com.deyvid.backend.entity.*;
import com.deyvid.backend.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import java.time.LocalDateTime;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class PasswordResetSecurityTest {
    UserRepository users = mock(UserRepository.class);
    PasswordResetTokenRepository tokens = mock(PasswordResetTokenRepository.class);
    EmailService mail = mock(EmailService.class);
    BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    PasswordResetService service = new PasswordResetService(users, tokens, mail, encoder, mock(AuditLogService.class));
    User user = User.builder().id(UUID.randomUUID()).email("audit@example.test").name("Test").build();
    PasswordResetToken token = PasswordResetToken.builder().user(user).otpCode(encoder.encode("123456"))
            .expiresAt(LocalDateTime.now().plusMinutes(15)).build();

    @Test void locksOutAfterFiveIncorrectAttemptsIncludingCorrectCode() {
        when(tokens.findTopByUserEmailIgnoreCaseAndIsUsedFalseOrderByCreatedAtDesc(anyString())).thenReturn(Optional.of(token));
        for (int i = 0; i < 5; i++) assertThrows(IllegalArgumentException.class, () -> service.verifyResetCode(user.getEmail(), "000000"));
        assertEquals(5, token.getFailedAttempts());
        assertThrows(IllegalArgumentException.class, () -> service.verifyResetCode(user.getEmail(), "123456"));
        assertThrows(IllegalArgumentException.class, () -> service.resetPasswordWithCode(user.getEmail(), "123456", "NewPassword123!"));
        verifyNoInteractions(users);
    }
    @Test void newCodeInvalidatesPreviousAndStoresOnlyHash() {
        when(users.findByEmailIgnoreCase(user.getEmail())).thenReturn(Optional.of(user));
        service.requestPasswordReset(user.getEmail());
        var tokenCaptor = org.mockito.ArgumentCaptor.forClass(PasswordResetToken.class);
        var codeCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(tokens).invalidateForUser(user.getId());
        verify(tokens).save(tokenCaptor.capture());
        verify(mail).sendPasswordResetOtp(eq(user.getEmail()), eq(user.getName()), codeCaptor.capture());
        assertNotEquals(codeCaptor.getValue(), tokenCaptor.getValue().getOtpCode());
        assertTrue(encoder.matches(codeCaptor.getValue(), tokenCaptor.getValue().getOtpCode()));
    }
    @Test void passwordResetConsumesCodeAndRevokesSessions() {
        when(tokens.findTopByUserEmailIgnoreCaseAndIsUsedFalseOrderByCreatedAtDesc(anyString())).thenReturn(Optional.of(token));
        user.setTokenVersion(4);
        service.resetPasswordWithCode(user.getEmail(), "123456", "NewPassword123!");
        assertTrue(token.isUsed()); assertEquals(5, user.getTokenVersion());
        assertTrue(encoder.matches("NewPassword123!", user.getPasswordHash()));
        verify(users).save(user);
    }
}
