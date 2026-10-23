package com.deyvid.backend.repository;

import com.deyvid.backend.dto.request.ContentAdaptRequest;
import com.deyvid.backend.entity.ContentVariant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ContentVariantRepository extends JpaRepository<ContentVariant, UUID> {
    List<ContentVariant> findByDraft_IdAndTenant_IdOrderByUpdatedAtDesc(UUID draftId, UUID tenantId);
    Optional<ContentVariant> findByDraft_IdAndTenant_IdAndChannel(UUID draftId, UUID tenantId,
                                                                  ContentAdaptRequest.Channel channel);
}
