package com.deyvid.backend.service;

import com.deyvid.backend.entity.AccountInvitation;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.repository.AccountInvitationRepository;
import com.deyvid.backend.repository.UserRepository;
import com.deyvid.backend.dto.response.AccountInvitationResponse;
import com.deyvid.backend.dto.response.CreatedAccountInvitationResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AccountInvitationService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int TOKEN_BYTES = 32;
    private static final int EXPIRATION_HOURS = 72;

    private final AccountInvitationRepository invitationRepository;
    private final UserRepository userRepository;
    private final TenantService tenantService;
    private final AuditLogService auditLogService;

    @Value("${app.frontend-base-url:http://localhost:4200}")
    private String frontendBaseUrl;

    @Transactional
    public CreatedAccountInvitationResponse create(String email, User administrator) {
        String normalizedEmail = normalizeEmail(email);
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new IllegalArgumentException("Ya existe una cuenta con ese correo");
        }

        LocalDateTime now = LocalDateTime.now();
        invitationRepository.findFirstByEmailIgnoreCaseAndAcceptedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc(normalizedEmail)
                .ifPresent(existing -> {
                    if (existing.getExpiresAt().isAfter(now)) {
                        throw new IllegalArgumentException("Ya existe una invitación pendiente para ese correo");
                    }
                    existing.setRevokedAt(now);
                    invitationRepository.save(existing);
                });

        byte[] tokenBytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(tokenBytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
        LocalDateTime expiresAt = now.plusHours(EXPIRATION_HOURS);
        AccountInvitation invitation = invitationRepository.save(AccountInvitation.builder()
                .email(normalizedEmail)
                .tokenHash(hash(token))
                .createdBy(administrator)
                .expiresAt(expiresAt)
                .build());

        auditLogService.recordAction(administrator.getTenant(), administrator.getEmail(),
                "ADMIN_INVITATION_CREATED", "Invitación de cuenta creada para " + normalizedEmail);
        return new CreatedAccountInvitationResponse(invitation.getId(), normalizedEmail,
                invitationUrl(token), expiresAt);
    }

    @Transactional(readOnly = true)
    public Page<AccountInvitationResponse> list(Pageable pageable) {
        LocalDateTime now = LocalDateTime.now();
        return invitationRepository.findAllByOrderByCreatedAtDesc(pageable)
                .map(invitation -> toResponse(invitation, now));
    }

    @Transactional
    public AccountInvitationResponse revoke(UUID invitationId, User administrator) {
        AccountInvitation invitation = invitationRepository.findByIdForUpdate(invitationId)
                .orElseThrow(() -> new IllegalArgumentException("La invitación no existe"));
        LocalDateTime now = LocalDateTime.now();
        if (invitation.getAcceptedAt() != null) {
            throw new IllegalArgumentException("No se puede revocar una invitación que ya fue aceptada");
        }
        if (invitation.getRevokedAt() == null) {
            invitation.setRevokedAt(now);
            invitation = invitationRepository.save(invitation);
            auditLogService.recordAction(administrator.getTenant(), administrator.getEmail(),
                    "ADMIN_INVITATION_REVOKED", "Invitación revocada para " + invitation.getEmail());
        }
        return toResponse(invitation, now);
    }

    @Transactional
    public String accept(String token, String name, String password) {
        AccountInvitation invitation = invitationRepository.findByTokenHashForUpdate(hash(token))
                .orElseThrow(AccountInvitationService::invalidInvitation);
        LocalDateTime now = LocalDateTime.now();
        if (invitation.getAcceptedAt() != null || invitation.getRevokedAt() != null
                || !invitation.getExpiresAt().isAfter(now)) {
            throw invalidInvitation();
        }
        if (userRepository.existsByEmailIgnoreCase(invitation.getEmail())) {
            throw new IllegalArgumentException("Ya existe una cuenta con ese correo");
        }

        User created = tenantService.registerUserAndTenant(name.trim(), invitation.getEmail(), password);
        invitation.setAcceptedAt(now);
        invitationRepository.save(invitation);
        auditLogService.recordAction(created.getTenant(), created.getEmail(),
                "ACCOUNT_INVITATION_ACCEPTED", "Invitación de cuenta aceptada");
        return created.getEmail();
    }

    private AccountInvitationResponse toResponse(AccountInvitation invitation, LocalDateTime now) {
        String status;
        if (invitation.getAcceptedAt() != null) status = "ACCEPTED";
        else if (invitation.getRevokedAt() != null) status = "REVOKED";
        else if (!invitation.getExpiresAt().isAfter(now)) status = "EXPIRED";
        else status = "PENDING";
        return new AccountInvitationResponse(invitation.getId(), invitation.getEmail(),
                invitation.getCreatedAt(), invitation.getExpiresAt(), invitation.getAcceptedAt(),
                invitation.getRevokedAt(), status);
    }

    private String invitationUrl(String token) {
        String base = frontendBaseUrl == null ? "" : frontendBaseUrl.trim().replaceAll("/+$", "");
        try {
            URI uri = URI.create(base);
            if (!("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    || uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null
                    || uri.getFragment() != null) {
                throw new IllegalStateException("app.frontend-base-url debe ser una URL HTTP(S) válida");
            }
        } catch (IllegalArgumentException error) {
            throw new IllegalStateException("app.frontend-base-url debe ser una URL HTTP(S) válida", error);
        }
        // Keep the bearer token in the fragment: browsers do not send fragments to the web server or in referrers.
        return base + "/auth/accept-invitation#token=" + token;
    }

    private static IllegalArgumentException invalidInvitation() {
        return new IllegalArgumentException("La invitación no es válida, ya fue usada o venció");
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 no está disponible", error);
        }
    }
}
