package com.deyvid.backend.repository;

import com.deyvid.backend.entity.PublishingSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PublishingScheduleRepository extends JpaRepository<PublishingSchedule, UUID> {
    List<PublishingSchedule> findByTenantId(UUID tenantId);
    List<PublishingSchedule> findByTenantIdAndIsActiveTrue(UUID tenantId);
}
