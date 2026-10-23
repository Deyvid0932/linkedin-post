package com.deyvid.backend.repository;

import com.deyvid.backend.entity.WebhookDelivery;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface WebhookDeliveryRepository extends JpaRepository<WebhookDelivery, UUID> {
    Page<WebhookDelivery> findByTenantIdOrderByCreatedAtDesc(UUID tenantId, Pageable pageable);
    Optional<WebhookDelivery> findByIdAndTenantId(UUID id, UUID tenantId);
}
