package com.deyvid.backend.controller;

import com.deyvid.backend.dto.request.UpdateUserRequest;
import com.deyvid.backend.dto.response.UserProfileResponse;
import com.deyvid.backend.entity.Role;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.repository.UserRepository;
import com.deyvid.backend.security.AuthHelper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final AuthHelper authHelper;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getCurrentUser(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        return ResponseEntity.ok(mapToResponse(user));
    }

    @PutMapping("/me")
    public ResponseEntity<UserProfileResponse> updateProfile(Authentication auth, @Valid @RequestBody UpdateUserRequest request) {
        User user = authHelper.getCurrentUser(auth);

        if (request.name() != null && !request.name().isBlank()) {
            user.setName(request.name().trim());
        }

        if (request.newPassword() != null && !request.newPassword().isBlank()) {
            if (request.newPassword().trim().length() < 6) {
                throw new IllegalArgumentException("La nueva contraseña debe tener al menos 6 caracteres");
            }
            if (request.currentPassword() == null || !passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
                throw new IllegalArgumentException("La contraseña actual es incorrecta");
            }
            user.setPasswordHash(passwordEncoder.encode(request.newPassword().trim()));
            user.setTokenVersion(user.getTokenVersion() + 1);
        }

        User saved = userRepository.save(user);
        return ResponseEntity.ok(mapToResponse(saved));
    }

    @DeleteMapping("/me")
    public ResponseEntity<Map<String, Object>> deleteAccount(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        user.setIsActive(false);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Cuenta de usuario desactivada exitosamente"));
    }

    private UserProfileResponse mapToResponse(User user) {
        Set<String> roleNames = user.getRoles().stream().map(Role::getName).collect(Collectors.toSet());
        return new UserProfileResponse(
                user.getId(),
                user.getTenant().getId(),
                user.getName(),
                user.getEmail(),
                user.getPictureUrl(),
                user.getIsActive(),
                roleNames,
                user.getCreatedAt()
        );
    }
}
