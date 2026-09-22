package com.deyvid.backend.repository;

import com.deyvid.backend.entity.PromptVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PromptVersionRepository extends JpaRepository<PromptVersion, UUID> {
    List<PromptVersion> findByTenantIdOrderByVersionNumberDesc(UUID tenantId);
    Optional<PromptVersion> findTopByTenantIdOrderByVersionNumberDesc(UUID tenantId);
}
