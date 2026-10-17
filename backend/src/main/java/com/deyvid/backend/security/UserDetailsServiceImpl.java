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

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {
    public static class Principal extends org.springframework.security.core.userdetails.User {
        private final long tokenVersion;
        public Principal(User user, List<SimpleGrantedAuthority> authorities) {
            super(user.getEmail(), user.getPasswordHash() != null ? user.getPasswordHash() : "", user.getIsActive(), true, true, true, authorities);
            this.tokenVersion = user.getTokenVersion();
        }
        public long getTokenVersion() { return tokenVersion; }
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
