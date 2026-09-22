package com.deyvid.backend.repository;

import com.deyvid.backend.entity.DraftPreview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DraftPreviewRepository extends JpaRepository<DraftPreview, UUID> {
    Optional<DraftPreview> findByTenantId(UUID tenantId);
    Optional<DraftPreview> findFirstByTenantIdOrderByCreatedAtAsc(UUID tenantId);
    Optional<DraftPreview> findFirstByTenantIdOrderByUpdatedAtDesc(UUID tenantId);
    List<DraftPreview> findAllByTenantIdOrderByCreatedAtAsc(UUID tenantId);
    List<DraftPreview> findAllByTenantId(UUID tenantId);
    long countByTenantId(UUID tenantId);
}
