package com.deyvid.backend.repository;

import com.deyvid.backend.entity.GitHubCredential;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface GitHubCredentialRepository extends JpaRepository<GitHubCredential, UUID> {
    Optional<GitHubCredential> findByTenantId(UUID tenantId);
}
