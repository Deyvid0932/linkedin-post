package com.deyvid.backend.repository;

import com.deyvid.backend.entity.TenantAiCredential;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TenantAiCredentialRepository extends JpaRepository<TenantAiCredential, UUID> {
    List<TenantAiCredential> findAllByTenantId(UUID tenantId);
    Optional<TenantAiCredential> findByTenantIdAndProvider(UUID tenantId, String provider);
    void deleteByTenantIdAndProvider(UUID tenantId, String provider);
}
