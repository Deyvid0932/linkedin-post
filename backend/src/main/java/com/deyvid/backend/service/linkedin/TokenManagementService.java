package com.deyvid.backend.service.linkedin;

import com.deyvid.backend.entity.LinkedInCredential;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.exception.TokenExpiredException;
import com.deyvid.backend.repository.LinkedInCredentialRepository;
import com.deyvid.backend.service.EncryptionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class TokenManagementService {

    private final LinkedInCredentialRepository linkedInCredentialRepository;
    private final EncryptionService encryptionService;

    @Transactional(readOnly = true)
    public String getValidAccessToken(Tenant tenant) {
        LinkedInCredential cred = linkedInCredentialRepository.findByTenantId(tenant.getId())
                .orElseThrow(() -> new TokenExpiredException("No existen credenciales de LinkedIn configuradas para el tenant " + tenant.getId()));

        return getValidAccessToken(cred);
    }

    @Transactional(readOnly = true)
    public String getValidAccessToken(LinkedInCredential cred) {
        if (!cred.getIsValid() || cred.getTokenExpiresAt().isBefore(LocalDateTime.now())) {
            log.error("Token de LinkedIn expirado o inválido para credencial ID {}", cred.getId());
            throw new TokenExpiredException("El token de acceso a LinkedIn ha expirado para la cuenta '" + 
                    (cred.getDisplayName() != null ? cred.getDisplayName() : cred.getEffectiveAuthorUrn()) + "'. Por favor reconecta tu cuenta.");
        }

        return encryptionService.decrypt(cred.getAccessTokenEnc());
    }

    @Transactional(readOnly = true)
    public Optional<LinkedInCredential> getCredentialByTenant(Tenant tenant) {
        return linkedInCredentialRepository.findByTenantId(tenant.getId());
    }

    @Transactional(readOnly = true)
    public List<LinkedInCredential> getEnabledCredentials(UUID tenantId) {
        return linkedInCredentialRepository.findByTenantIdAndIsEnabledTrue(tenantId);
    }

    @Transactional(readOnly = true)
    public List<LinkedInCredential> getAllCredentials(UUID tenantId) {
        return linkedInCredentialRepository.findByTenantIdOrderByCreatedAtAsc(tenantId);
    }
}
