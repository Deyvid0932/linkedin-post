package com.deyvid.backend.repository;

import com.deyvid.backend.entity.PublicationLog;
import com.deyvid.backend.entity.enums.PublicationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PublicationLogRepository extends JpaRepository<PublicationLog, UUID>, JpaSpecificationExecutor<PublicationLog> {
    @Query(value = """
            select to_char(((created_at at time zone 'UTC') at time zone 'America/Lima')::date, 'YYYY-MM-DD'),
                   status, count(*)
            from publication_logs
            where created_at >= ((cast(:from as timestamp) at time zone 'America/Lima') at time zone 'UTC')
              and status in ('SUCCESS', 'FAILED')
            group by 1, status
            order by 1
            """, nativeQuery = true)
    List<Object[]> summarizePublicationOutcomesByDaySince(@Param("from") java.time.LocalDateTime from);

    Page<PublicationLog> findByTenantIdOrderByCreatedAtDesc(UUID tenantId, Pageable pageable);
    List<PublicationLog> findByTenantId(UUID tenantId);
    List<PublicationLog> findByTenantIdAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc(
            UUID tenantId, java.time.LocalDateTime createdAt);
    List<PublicationLog> findByTenantIdAndStatus(UUID tenantId, PublicationStatus status);
    List<PublicationLog> findTop5ByTenantIdAndStatusOrderByCreatedAtDesc(UUID tenantId, PublicationStatus status);
    long countByTenantIdAndStatus(UUID tenantId, PublicationStatus status);
    long countByStatus(PublicationStatus status);

    @Query("select coalesce(sum(p.llmTokensUsed), 0) from PublicationLog p where p.createdAt >= :from")
    long sumRecordedTokensSince(@Param("from") java.time.LocalDateTime from);
    
    // Conteo para límite diario de publicaciones por cuenta específica (PERSON / ORGANIZATION)
    long countByTenantIdAndStatusAndAuthorUrnAndCreatedAtGreaterThanEqual(
            UUID tenantId, PublicationStatus status, String authorUrn, java.time.LocalDateTime startOfDay);

    // Verificación de idempotencia para prevenir publicaciones duplicadas en ventana de 5 minutos
    boolean existsByTenantIdAndStatusAndTextHashAndCreatedAtAfter(
            UUID tenantId, PublicationStatus status, String textHash, java.time.LocalDateTime after);

    void deleteByTenantIdAndStatusAndAuthorUrnAndCreatedAtGreaterThanEqual(
            UUID tenantId, PublicationStatus status, String authorUrn, java.time.LocalDateTime startOfDay);

    void deleteByTenantId(UUID tenantId);
}
