package com.deyvid.backend.repository;

import com.deyvid.backend.entity.LinkedInOAuthState;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Optional;

public interface LinkedInOAuthStateRepository extends JpaRepository<LinkedInOAuthState, String> {
    Optional<LinkedInOAuthState> findByStateHashAndExpiresAtAfter(String stateHash, Instant now);
    long deleteByExpiresAtBefore(Instant now);
}
