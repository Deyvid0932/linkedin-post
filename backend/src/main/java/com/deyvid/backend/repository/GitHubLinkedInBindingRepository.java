package com.deyvid.backend.repository;

import com.deyvid.backend.entity.GitHubLinkedInBinding;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GitHubLinkedInBindingRepository extends JpaRepository<GitHubLinkedInBinding, UUID> {
    Optional<GitHubLinkedInBinding> findByTenantIdAndRepositoryId(UUID tenantId, UUID repositoryId);
    List<GitHubLinkedInBinding> findByTenantId(UUID tenantId);
    List<GitHubLinkedInBinding> findByLinkedInCredentialId(UUID linkedInCredentialId);
}
