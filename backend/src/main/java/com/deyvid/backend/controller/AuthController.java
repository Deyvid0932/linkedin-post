package com.deyvid.backend.controller;

import com.deyvid.backend.dto.request.ForgotPasswordRequest;
import com.deyvid.backend.dto.request.LoginRequest;
import com.deyvid.backend.dto.request.RegisterRequest;
import com.deyvid.backend.dto.request.ResetPasswordRequest;
import com.deyvid.backend.dto.request.VerifyCodeRequest;
import com.deyvid.backend.dto.response.AuthResponse;
import com.deyvid.backend.entity.Role;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.repository.UserRepository;
import com.deyvid.backend.security.JwtTokenProvider;
import com.deyvid.backend.service.PasswordResetService;
import com.deyvid.backend.service.TenantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final TenantService tenantService;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;
    private final PasswordResetService passwordResetService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        User user = tenantService.registerUserAndTenant(request.name(), request.email(), request.password());

        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password())
        );

        return ResponseEntity.ok(buildAuthResponse(user, auth));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        String cleanEmail = request.email().toLowerCase();

        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(cleanEmail, request.password())
        );

        User user = userRepository.findByEmailIgnoreCase(request.email())
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        return ResponseEntity.ok(buildAuthResponse(user, auth));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        passwordResetService.requestPasswordReset(request.email());
        return ResponseEntity.ok(Map.of("message", "Código de verificación enviado al correo"));
    }

    @PostMapping("/verify-code")
    public ResponseEntity<Map<String, Object>> verifyCode(@Valid @RequestBody VerifyCodeRequest request) {
        boolean isValid = passwordResetService.verifyResetCode(request.email(), request.code());
        return ResponseEntity.ok(Map.of("valid", isValid, "message", "Código de verificación válido"));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.resetPasswordWithCode(request.email(), request.code(), request.newPassword());
        return ResponseEntity.ok(Map.of("message", "Contraseña restablecida con éxito"));
    }

    private AuthResponse buildAuthResponse(User user, Authentication auth) {
        String token = jwtTokenProvider.generateToken(auth, user.getTenant().getId());
        Set<String> roleNames = user.getRoles().stream().map(Role::getName).collect(Collectors.toSet());
        return new AuthResponse(token, user.getId(), user.getTenant().getId(), user.getName(), user.getEmail(), roleNames);
    }
}
