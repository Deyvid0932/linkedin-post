package com.deyvid.backend.repository;

import com.deyvid.backend.entity.BackupTopic;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BackupTopicRepository extends JpaRepository<BackupTopic, UUID> {
    List<BackupTopic> findByTenantId(UUID tenantId);
    
    // Obtener el siguiente tema no usado ordenado por prioridad descendente y fecha de creación ascendente
    Optional<BackupTopic> findFirstByTenantIdAndIsUsedFalseOrderByPriorityDescCreatedAtAsc(UUID tenantId);
}
