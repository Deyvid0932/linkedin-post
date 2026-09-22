package com.deyvid.backend.repository;

import com.deyvid.backend.entity.FeedbackIa;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FeedbackIaRepository extends JpaRepository<FeedbackIa, UUID> {

    List<FeedbackIa> findTop10ByTenantIdOrderByCreatedAtDesc(UUID tenantId);

    @Query("SELECT f FROM FeedbackIa f WHERE f.tenant.id = :tenantId AND f.puntajeUsuario = 1 ORDER BY f.createdAt DESC")
    List<FeedbackIa> findTopLikedByTenant(UUID tenantId, Pageable pageable);
}
