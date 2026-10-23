package com.deyvid.backend.repository;

import com.deyvid.backend.entity.AccountInvitation;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface AccountInvitationRepository extends JpaRepository<AccountInvitation, UUID> {
    Optional<AccountInvitation> findFirstByEmailIgnoreCaseAndAcceptedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc(String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select invitation from AccountInvitation invitation where invitation.tokenHash = :tokenHash")
    Optional<AccountInvitation> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select invitation from AccountInvitation invitation where invitation.id = :id")
    Optional<AccountInvitation> findByIdForUpdate(@Param("id") UUID id);

    Page<AccountInvitation> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
