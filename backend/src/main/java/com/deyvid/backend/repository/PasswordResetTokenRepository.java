package com.deyvid.backend.repository;

import com.deyvid.backend.entity.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, UUID> {

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    Optional<PasswordResetToken> findTopByUserEmailIgnoreCaseAndIsUsedFalseOrderByCreatedAtDesc(String email);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("UPDATE PasswordResetToken t SET t.isUsed = true WHERE t.user.id = :userId AND t.isUsed = false")
    void invalidateForUser(@org.springframework.data.repository.query.Param("userId") UUID userId);

    void deleteByExpiresAtBefore(LocalDateTime now);
}
