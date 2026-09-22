package com.deyvid.backend.repository;

import com.deyvid.backend.entity.LinkedInCredential;
import com.deyvid.backend.entity.enums.LinkedInAccountType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LinkedInCredentialRepository extends JpaRepository<LinkedInCredential, UUID> {
    
    // Obtener todas las cuentas del tenant ordenadas cronológicamente
    List<LinkedInCredential> findByTenantIdOrderByCreatedAtAsc(UUID tenantId);

    // Obtener todas las cuentas habilitadas para publicación automática/lote
    List<LinkedInCredential> findByTenantIdAndIsEnabledTrue(UUID tenantId);

    // Obtener la cuenta marcada explícitamente como principal
    Optional<LinkedInCredential> findByTenantIdAndIsPrimaryTrue(UUID tenantId);

    // Buscar cuenta por URN de autor (único por tenant)
    Optional<LinkedInCredential> findByTenantIdAndAuthorUrn(UUID tenantId, String authorUrn);

    // Buscar cuenta por tipo (ej. PERSON o ORGANIZATION)
    Optional<LinkedInCredential> findByTenantIdAndAccountType(UUID tenantId, LinkedInAccountType accountType);

    // Búsqueda de respaldo para retrocompatibilidad
    Optional<LinkedInCredential> findFirstByTenantIdOrderByIsPrimaryDescCreatedAtAsc(UUID tenantId);
    
    // Búsqueda para TokenExpirationCheckerJob
    List<LinkedInCredential> findByIsValidTrueAndTokenExpiresAtBefore(LocalDateTime expirationThreshold);

    // Búsqueda con bloqueo pesimista (SELECT ... FOR UPDATE) para control estricto de concurrencia y límite diario
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT c FROM LinkedInCredential c WHERE c.id = :id")
    Optional<LinkedInCredential> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") UUID id);

    // Compatibilidad legacy: devuelve la cuenta primaria o la primera registrada
    default Optional<LinkedInCredential> findByTenantId(UUID tenantId) {
        Optional<LinkedInCredential> primary = findByTenantIdAndIsPrimaryTrue(tenantId);
        if (primary.isPresent()) {
            return primary;
        }
        return findFirstByTenantIdOrderByIsPrimaryDescCreatedAtAsc(tenantId);
    }
}
