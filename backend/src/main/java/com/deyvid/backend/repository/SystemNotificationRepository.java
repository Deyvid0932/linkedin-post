package com.deyvid.backend.repository;

import com.deyvid.backend.entity.SystemNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SystemNotificationRepository extends JpaRepository<SystemNotification, UUID> {
    List<SystemNotification> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    List<SystemNotification> findByTenantIdAndIsReadFalseOrderByCreatedAtDesc(UUID tenantId);
    void deleteByTenantId(UUID tenantId);
}
