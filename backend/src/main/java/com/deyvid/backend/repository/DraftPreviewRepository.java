package com.deyvid.backend.repository;

import com.deyvid.backend.entity.DraftPreview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DraftPreviewRepository extends JpaRepository<DraftPreview, UUID> {
    Optional<DraftPreview> findFirstByTenantIdAndIsQueuedTrueOrderByCreatedAtAsc(UUID tenantId);
    List<DraftPreview> findAllByTenantIdAndIsQueuedTrueOrderByCreatedAtAsc(UUID tenantId);
    long countByTenantIdAndIsQueuedTrue(UUID tenantId);
    Optional<DraftPreview> findFirstByTenantIdAndIsPreviewTrueAndIsQueuedFalseOrderByUpdatedAtDesc(UUID tenantId);
    List<DraftPreview> findAllByTenantIdAndIsPreviewFalseOrderByUpdatedAtDesc(UUID tenantId);
    Optional<DraftPreview> findByIdAndTenantId(UUID id, UUID tenantId);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT d FROM DraftPreview d WHERE d.id = :id AND d.tenant.id = :tenantId")
    Optional<DraftPreview> findOwnedForUpdate(@org.springframework.data.repository.query.Param("id") UUID id,
                                            @org.springframework.data.repository.query.Param("tenantId") UUID tenantId);
    Optional<DraftPreview> findByTenantId(UUID tenantId);
    Optional<DraftPreview> findFirstByTenantIdOrderByCreatedAtAsc(UUID tenantId);
    Optional<DraftPreview> findFirstByTenantIdOrderByUpdatedAtDesc(UUID tenantId);
    List<DraftPreview> findAllByTenantIdOrderByCreatedAtAsc(UUID tenantId);
    List<DraftPreview> findAllByTenantId(UUID tenantId);
    long countByTenantId(UUID tenantId);
}
