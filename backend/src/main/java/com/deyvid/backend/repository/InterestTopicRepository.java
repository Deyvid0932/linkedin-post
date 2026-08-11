package com.deyvid.backend.repository;

import com.deyvid.backend.entity.InterestTopic;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface InterestTopicRepository extends JpaRepository<InterestTopic, UUID> {
    List<InterestTopic> findByTenantIdAndIsActiveTrue(UUID tenantId);
    List<InterestTopic> findByTenantId(UUID tenantId);
}
