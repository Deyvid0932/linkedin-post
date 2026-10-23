package com.deyvid.backend.security;

import com.deyvid.backend.entity.User;
import com.deyvid.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.time.Instant;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {
    public static class Principal extends org.springframework.security.core.userdetails.User {
        private final long tokenVersion;
        private final UUID userId;
        private final UUID tenantId;
        private final Integer aiRequestsPerMinute;
        private final Instant aiRequestsPerMinuteExpiresAt;
        public Principal(User user, List<SimpleGrantedAuthority> authorities) {
            super(user.getEmail(), user.getPasswordHash() != null ? user.getPasswordHash() : "", user.getIsActive(), true, true, true, authorities);
            this.tokenVersion = user.getTokenVersion();
            this.userId = user.getId();
            this.tenantId = user.getTenant() != null ? user.getTenant().getId() : null;
            this.aiRequestsPerMinute = user.getAiRequestsPerMinute();
            this.aiRequestsPerMinuteExpiresAt = user.getAiRequestsPerMinuteExpiresAt();
        }
        public long getTokenVersion() { return tokenVersion; }
        public UUID getUserId() { return userId; }
        public UUID getTenantId() { return tenantId; }
        public Integer getAiRequestsPerMinute() { return aiRequestsPerMinute; }
        public Instant getAiRequestsPerMinuteExpiresAt() { return aiRequestsPerMinuteExpiresAt; }
    }

    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        String cleanEmail = email != null ? email.trim().toLowerCase() : "";
        User user = userRepository.findByEmailIgnoreCase(cleanEmail)
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado con email: " + cleanEmail));

        if (!user.getIsActive()) {
            throw new UsernameNotFoundException("El usuario está inactivo");
        }

        List<SimpleGrantedAuthority> authorities = user.getRoles().stream()
                .map(role -> new SimpleGrantedAuthority(role.getName()))
                .toList();

        return new Principal(user, authorities);
    }
}
