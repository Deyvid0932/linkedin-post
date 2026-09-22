package com.deyvid.backend.repository;

import com.deyvid.backend.entity.PublicationLog;
import com.deyvid.backend.entity.enums.PublicationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PublicationLogRepository extends JpaRepository<PublicationLog, UUID>, JpaSpecificationExecutor<PublicationLog> {
    Page<PublicationLog> findByTenantIdOrderByCreatedAtDesc(UUID tenantId, Pageable pageable);
    List<PublicationLog> findByTenantId(UUID tenantId);
    List<PublicationLog> findByTenantIdAndStatus(UUID tenantId, PublicationStatus status);
    long countByTenantIdAndStatus(UUID tenantId, PublicationStatus status);
    
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
