package com.deyvid.backend.service;

import com.deyvid.backend.entity.PasswordResetToken;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.repository.PasswordResetTokenRepository;
import com.deyvid.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class PasswordResetService {

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;
    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public void requestPasswordReset(String email) {
        if (email == null || email.isBlank()) {
            return;
        }

        String cleanEmail = email.trim().toLowerCase();
        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(cleanEmail);

        if (userOpt.isEmpty()) {
            log.warn("Solicitud de recuperación de contraseña para correo no registrado: {}", cleanEmail);
            return; // Anti-enumeración de usuarios
        }

        User user = userOpt.get();
        passwordResetTokenRepository.invalidateForUser(user.getId());

        // 1. Generar código numérico de 6 dígitos criptográficamente seguro
        String otpCode = String.format("%06d", secureRandom.nextInt(1000000));

        // 2. Persistir token con expiración a 15 minutos
        PasswordResetToken token = PasswordResetToken.builder()
                .user(user)
                .otpCode(passwordEncoder.encode(otpCode))
                .expiresAt(LocalDateTime.now().plusMinutes(15))
                .isUsed(false)
                .build();

        passwordResetTokenRepository.save(token);

        // 3. Enviar correo asíncrono
        emailService.sendPasswordResetOtp(user.getEmail(), user.getName(), otpCode);
    }

    @Transactional(noRollbackFor = IllegalArgumentException.class)
    public boolean verifyResetCode(String email, String code) {
        if (email == null || code == null) {
            throw new IllegalArgumentException("El correo y el código son obligatorios");
        }

        String cleanEmail = email.trim().toLowerCase();
        String cleanCode = code.trim();

        PasswordResetToken token = passwordResetTokenRepository
                .findTopByUserEmailIgnoreCaseAndIsUsedFalseOrderByCreatedAtDesc(cleanEmail)
                .orElseThrow(() -> new IllegalArgumentException("Código de verificación inválido o expirado"));

        if (token.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("El código de verificación ha expirado. Solicita uno nuevo");
        }

        if (token.getFailedAttempts() >= 5) throw new IllegalArgumentException("Solicita un nuevo código de verificación");
        if (!passwordEncoder.matches(cleanCode, token.getOtpCode())) {
            token.setFailedAttempts(token.getFailedAttempts() + 1);
            passwordResetTokenRepository.save(token);
            throw new IllegalArgumentException("El código de verificación es incorrecto");
        }

        return true;
    }

    @Transactional(noRollbackFor = IllegalArgumentException.class)
    public void resetPasswordWithCode(String email, String code, String newPassword) {
        if (newPassword == null || newPassword.trim().length() < 6) {
            throw new IllegalArgumentException("La contraseña debe tener al menos 6 caracteres");
        }

        String cleanEmail = email.trim().toLowerCase();
        String cleanCode = code.trim();

        PasswordResetToken token = passwordResetTokenRepository
                .findTopByUserEmailIgnoreCaseAndIsUsedFalseOrderByCreatedAtDesc(cleanEmail)
                .orElseThrow(() -> new IllegalArgumentException("Código de verificación inválido o expirado"));

        if (token.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("El código de verificación ha expirado");
        }

        if (token.getFailedAttempts() >= 5) throw new IllegalArgumentException("Solicita un nuevo código de verificación");
        if (!passwordEncoder.matches(cleanCode, token.getOtpCode())) {
            token.setFailedAttempts(token.getFailedAttempts() + 1);
            passwordResetTokenRepository.save(token);
            throw new IllegalArgumentException("El código de verificación es incorrecto");
        }

        // 1. Actualizar contraseña del usuario con BCrypt
        User user = token.getUser();
        user.setPasswordHash(passwordEncoder.encode(newPassword.trim()));
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);

        // 2. Quemar el token OTP (One-Time Password)
        token.setUsed(true);
        passwordResetTokenRepository.save(token);

        // 3. Registrar auditoría de seguridad
        if (user.getTenant() != null) {
            auditLogService.recordAction(
                    user.getTenant(),
                    user.getEmail(),
                    "PASSWORD_RESET",
                    "Contraseña restablecida exitosamente mediante código OTP de 6 dígitos"
            );
        }

        log.info("🔐 Contraseña actualizada exitosamente para el usuario: {}", user.getEmail());
    }
}
