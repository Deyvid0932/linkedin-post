package com.deyvid.backend.repository;

import com.deyvid.backend.entity.TenantWebhookEndpoint;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TenantWebhookEndpointRepository extends JpaRepository<TenantWebhookEndpoint, UUID> {
    List<TenantWebhookEndpoint> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    List<TenantWebhookEndpoint> findByTenantIdAndActiveTrue(UUID tenantId);
    Optional<TenantWebhookEndpoint> findByIdAndTenantId(UUID id, UUID tenantId);
}
