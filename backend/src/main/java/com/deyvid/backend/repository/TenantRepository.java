package com.deyvid.backend.repository;

import com.deyvid.backend.entity.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface TenantRepository extends JpaRepository<Tenant, UUID> {
    @Query(value = """
            select t.id as tenantId, min(u.email) as primaryEmail, count(u.id) as accountCount,
                   t.aiRequestsPerMinute as overrideRequestsPerMinute,
                   t.aiRequestsPerMinuteExpiresAt as overrideExpiresAt
            from Tenant t left join User u on u.tenant.id = t.id
            group by t.id, t.aiRequestsPerMinute, t.aiRequestsPerMinuteExpiresAt
            order by min(u.email), t.id
            """,
            countQuery = "select count(t.id) from Tenant t")
    Page<TenantAiQuotaProjection> findTenantAiQuotaSummaries(Pageable pageable);

    @Query("""
            select t.id as tenantId, min(u.email) as primaryEmail, count(u.id) as accountCount,
                   t.aiRequestsPerMinute as overrideRequestsPerMinute,
                   t.aiRequestsPerMinuteExpiresAt as overrideExpiresAt
            from Tenant t left join User u on u.tenant.id = t.id
            where t.id = :tenantId
            group by t.id, t.aiRequestsPerMinute, t.aiRequestsPerMinuteExpiresAt
            """)
    java.util.Optional<TenantAiQuotaProjection> findTenantAiQuotaById(
            @org.springframework.data.repository.query.Param("tenantId") UUID tenantId);

    // Serializes publishers but allows the durable receipt transaction to acquire FK KEY SHARE.
    @org.springframework.data.jpa.repository.Query(value = "SELECT * FROM tenants WHERE id = :id FOR NO KEY UPDATE", nativeQuery = true)
    java.util.Optional<Tenant> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") UUID id);
}
