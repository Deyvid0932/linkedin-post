package com.deyvid.backend.repository;

import com.deyvid.backend.entity.GitHubRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface GitHubRepositoryRepo extends JpaRepository<GitHubRepository, UUID> {
    List<GitHubRepository> findByTenantIdAndIsActiveTrue(UUID tenantId);
    Optional<GitHubRepository> findByTenantIdAndRepoOwnerAndRepoName(UUID tenantId, String repoOwner, String repoName);
}
