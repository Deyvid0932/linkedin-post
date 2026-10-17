package com.deyvid.backend.repository;

import com.deyvid.backend.entity.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface TenantRepository extends JpaRepository<Tenant, UUID> {
    // Serializes publishers but allows the durable receipt transaction to acquire FK KEY SHARE.
    @org.springframework.data.jpa.repository.Query(value = "SELECT * FROM tenants WHERE id = :id FOR NO KEY UPDATE", nativeQuery = true)
    java.util.Optional<Tenant> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") UUID id);
}
