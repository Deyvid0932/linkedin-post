package com.deyvid.backend.repository;

import com.deyvid.backend.entity.BackupTopic;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BackupTopicRepository extends JpaRepository<BackupTopic, UUID> {
    List<BackupTopic> findByTenantIdOrderByPriorityDescCreatedAtAsc(UUID tenantId);
    List<BackupTopic> findByTenantId(UUID tenantId);

    // Búsqueda de temas NO usados (isUsed = false)
    Optional<BackupTopic> findFirstByTenantIdAndIsUsedFalseAndIsActiveTrueOrderByPriorityDescCreatedAtAsc(UUID tenantId);
    Optional<BackupTopic> findFirstByTenantIdAndIsUsedFalseOrderByPriorityDescCreatedAtAsc(UUID tenantId);

    // Reciclaje de temas (cuando todos ya fueron usados): rota el usado hace más tiempo (menor usedAt)
    Optional<BackupTopic> findFirstByTenantIdAndIsActiveTrueOrderByUsedAtAscCreatedAtAsc(UUID tenantId);
    Optional<BackupTopic> findFirstByTenantIdOrderByUsedAtAscCreatedAtAsc(UUID tenantId);

    // Búsqueda por título para marcar como usado
    Optional<BackupTopic> findFirstByTenantIdAndTitleIgnoreCase(UUID tenantId, String title);
    Optional<BackupTopic> findFirstByTenantIdAndTitleContainingIgnoreCase(UUID tenantId, String title);
}
