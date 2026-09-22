package com.deyvid.backend.security;

import com.deyvid.backend.entity.User;
import com.deyvid.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Helper centralizado y reutilizable para resolver el usuario autenticado
 * y el Tenant actual en Spring Boot 4 / Java 26, eliminando duplicaciones
 * en controladores y servicios.
 */
@Component
@RequiredArgsConstructor
public class AuthHelper {

    private final UserRepository userRepository;

    public User getCurrentUser(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new IllegalArgumentException("Usuario no autenticado");
        }
        return userRepository.findByEmailIgnoreCase(auth.getName())
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado: " + auth.getName()));
    }

    public UUID getCurrentTenantId(Authentication auth) {
        return getCurrentUser(auth).getTenant().getId();
    }

    public String getCurrentUserEmail(Authentication auth) {
        if (auth == null) {
            throw new IllegalArgumentException("Sesión no válida");
        }
        return auth.getName();
    }
}
