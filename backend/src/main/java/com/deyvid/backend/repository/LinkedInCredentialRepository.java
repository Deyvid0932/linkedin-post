package com.deyvid.backend.repository;

import com.deyvid.backend.entity.LinkedInCredential;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LinkedInCredentialRepository extends JpaRepository<LinkedInCredential, UUID> {
    Optional<LinkedInCredential> findByTenantId(UUID tenantId);
    
    // Para el TokenExpirationCheckerJob
    List<LinkedInCredential> findByIsValidTrueAndTokenExpiresAtBefore(LocalDateTime expirationThreshold);
}
