package com.deyvid.backend.service;

import com.deyvid.backend.entity.Role;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.repository.RoleRepository;
import com.deyvid.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/** Grants administrator access only to addresses explicitly configured by the server owner. */
@Component
@RequiredArgsConstructor
@Slf4j
public class ConfiguredAdminBootstrap implements ApplicationRunner {
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;

    @Value("${app.admin-emails:}")
    private String configuredAdminEmails;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        Set<String> adminEmails = configuredEmails();
        if (adminEmails.isEmpty()) return;

        Role adminRole = roleRepository.findByName("ROLE_ADMIN")
                .orElseThrow(() -> new IllegalStateException("ROLE_ADMIN no está configurado"));
        for (String email : adminEmails) {
            userRepository.findByEmailIgnoreCase(email).ifPresent(user -> grant(user, adminRole));
        }
    }

    @Transactional
    public void grantIfConfigured(User user) {
        if (!configuredEmails().contains(normalize(user.getEmail()))) return;
        Role adminRole = roleRepository.findByName("ROLE_ADMIN")
                .orElseThrow(() -> new IllegalStateException("ROLE_ADMIN no está configurado"));
        grant(user, adminRole);
    }

    private Set<String> configuredEmails() {
        if (configuredAdminEmails == null || configuredAdminEmails.isBlank()) return Set.of();
        return Arrays.stream(configuredAdminEmails.split(","))
                .map(String::trim)
                .filter(email -> !email.isBlank())
                .map(this::normalize)
                .collect(Collectors.toUnmodifiableSet());
    }

    private String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private void grant(User user, Role adminRole) {
        Set<Role> roles = new HashSet<>(user.getRoles());
        if (roles.add(adminRole)) {
            user.setRoles(roles);
            userRepository.save(user);
            log.info("Administrator role synchronized for a configured account");
        }
    }
}
