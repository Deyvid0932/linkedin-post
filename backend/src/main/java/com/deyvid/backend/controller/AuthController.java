package com.deyvid.backend.controller;

import com.deyvid.backend.dto.request.ForgotPasswordRequest;
import com.deyvid.backend.dto.request.LoginRequest;
import com.deyvid.backend.dto.request.RegisterRequest;
import com.deyvid.backend.dto.request.ResetPasswordRequest;
import com.deyvid.backend.dto.request.VerifyCodeRequest;
import com.deyvid.backend.dto.request.AcceptAccountInvitationRequest;
import com.deyvid.backend.dto.response.AuthResponse;
import com.deyvid.backend.dto.response.AcceptedAccountInvitationResponse;
import com.deyvid.backend.entity.Role;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.repository.UserRepository;
import com.deyvid.backend.security.JwtTokenProvider;
import com.deyvid.backend.security.SessionCookieFactory;
import com.deyvid.backend.service.PasswordResetService;
import com.deyvid.backend.service.AccountInvitationService;
import com.deyvid.backend.service.TenantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.time.Duration;
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
    private final AccountInvitationService accountInvitationService;
    private final SessionCookieFactory sessionCookieFactory;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        User user = tenantService.registerUserAndTenant(request.name(), request.email(), request.password());

        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password())
        );

        return sessionResponse(user, auth);
    }

    @PostMapping("/invitations/accept")
    public ResponseEntity<AcceptedAccountInvitationResponse> acceptInvitation(
            @Valid @RequestBody AcceptAccountInvitationRequest request) {
        String email = accountInvitationService.accept(request.token(), request.name(), request.password());
        return ResponseEntity.ok(new AcceptedAccountInvitationResponse(email,
                "Cuenta creada. Ya puedes iniciar sesión."));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        String cleanEmail = request.email().toLowerCase();

        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(cleanEmail, request.password())
        );

        User user = userRepository.findByEmailIgnoreCase(request.email())
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        return sessionResponse(user, auth);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, sessionCookieFactory.expire().toString())
                .cacheControl(CacheControl.noStore())
                .build();
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

    private ResponseEntity<AuthResponse> sessionResponse(User user, Authentication auth) {
        String token = jwtTokenProvider.generateToken(auth, user.getTenant().getId());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, sessionCookieFactory.issue(token, Duration.ofMillis(jwtTokenProvider.getExpirationMs())).toString())
                .cacheControl(CacheControl.noStore())
                .body(buildAuthResponse(user));
    }

    private AuthResponse buildAuthResponse(User user) {
        Set<String> roleNames = user.getRoles().stream().map(Role::getName).collect(Collectors.toSet());
        return new AuthResponse(user.getId(), user.getTenant().getId(), user.getName(), user.getEmail(), roleNames);
    }
}
