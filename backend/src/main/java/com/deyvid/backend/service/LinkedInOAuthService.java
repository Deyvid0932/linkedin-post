package com.deyvid.backend.service;

import com.deyvid.backend.entity.LinkedInCredential;
import com.deyvid.backend.entity.LinkedInOAuthState;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.entity.enums.LinkedInAccountType;
import com.deyvid.backend.repository.LinkedInCredentialRepository;
import com.deyvid.backend.repository.LinkedInOAuthStateRepository;
import com.deyvid.backend.repository.UserRepository;
import com.deyvid.backend.security.AuthHelper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import org.springframework.util.LinkedMultiValueMap;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LinkedInOAuthService {
    private static final String COOKIE = "autopost_linkedin_oauth";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final LinkedInOAuthStateRepository states;
    private final LinkedInCredentialRepository credentials;
    private final UserRepository users;
    private final AuthHelper auth;
    private final EncryptionService encryption;
    private final AuditLogService audit;
    private final JsonMapper json = JsonMapper.builder().build();
    private final WebClient http = WebClient.builder().build();

    @Value("${app.linkedin.oauth.client-id:}") private String clientId;
    @Value("${app.linkedin.oauth.client-secret:}") private String clientSecret;
    @Value("${app.linkedin.oauth.redirect-uri}") private String redirectUri;
    @Value("${app.linkedin.oauth.frontend-url:http://localhost:4200}") private String frontendUrl;
    @Value("${app.linkedin.oauth.secure-cookie:true}") private boolean secureCookie;

    public record StartResult(String authorizationUrl, ResponseCookie browserCookie) {}

    @Transactional
    public StartResult start(org.springframework.security.core.Authentication principal) {
        if (clientId.isBlank() || clientSecret.isBlank()) {
            throw new ResponseStatusException(HttpStatus.FAILED_DEPENDENCY,
                    "OAuth de LinkedIn no está configurado en el servidor. Define LINKEDIN_CLIENT_ID y LINKEDIN_CLIENT_SECRET y reinicia el backend.");
        }
        User user = auth.getCurrentUser(principal);
        states.deleteByExpiresAtBefore(Instant.now());
        String state = randomToken(32);
        String browser = randomToken(32);
        states.save(LinkedInOAuthState.builder().stateHash(sha256(state)).browserHash(sha256(browser))
                .userId(user.getId()).tenantId(user.getTenant().getId()).expiresAt(Instant.now().plusSeconds(600)).build());
        String url = "https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=" + encode(clientId)
                + "&redirect_uri=" + encode(redirectUri) + "&state=" + encode(state)
                + "&scope=" + encode("openid profile w_member_social");
        return new StartResult(url, ResponseCookie.from(COOKIE, browser).httpOnly(true).secure(secureCookie)
                .sameSite("Lax").path("/api/v1/credentials/linkedin/oauth/callback").maxAge(600).build());
    }

    @Transactional
    public String complete(String state, String browser, String code) {
        if (state == null || browser == null || code == null || code.isBlank()) return "failed";
        String hash = sha256(state);
        LinkedInOAuthState attempt = states.findByStateHashAndExpiresAtAfter(hash, Instant.now()).orElse(null);
        if (attempt == null || !MessageDigest.isEqual(attempt.getBrowserHash().getBytes(StandardCharsets.US_ASCII), sha256(browser).getBytes(StandardCharsets.US_ASCII))) {
            states.deleteById(hash);
            return "failed";
        }
        states.delete(attempt); // single-use, including provider or token-exchange failures
        try {
            var form = new LinkedMultiValueMap<String, String>();
            form.add("grant_type", "authorization_code"); form.add("code", code); form.add("client_id", clientId);
            form.add("client_secret", clientSecret); form.add("redirect_uri", redirectUri);
            Map<?, ?> token = http.post().uri("https://www.linkedin.com/oauth/v2/accessToken")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED).bodyValue(form)
                    .retrieve().bodyToMono(Map.class).block();
            if (token == null || !(token.get("access_token") instanceof String accessToken)
                    || !(token.get("expires_in") instanceof Number expires)) return "failed";
            Map<?, ?> profile = http.get().uri("https://api.linkedin.com/v2/userinfo")
                    .headers(h -> h.setBearerAuth(accessToken)).retrieve().bodyToMono(Map.class).block();
            if (profile == null || !(profile.get("sub") instanceof String subject) || !subject.matches("[A-Za-z0-9_-]{1,128}")) return "failed";

            User user = users.findById(attempt.getUserId()).filter(u -> u.getTenant().getId().equals(attempt.getTenantId())
                    && Boolean.TRUE.equals(u.getIsActive())).orElse(null);
            if (user == null) return "failed";
            String urn = "urn:li:person:" + subject;
            LinkedInCredential credential = credentials.findByTenantIdAndAuthorUrn(attempt.getTenantId(), urn)
                    .orElseGet(() -> LinkedInCredential.builder().tenant(user.getTenant()).build());
            boolean primary = credential.getId() == null && credentials.findByTenantIdOrderByCreatedAtAsc(attempt.getTenantId()).isEmpty();
            credential.setAccountType(LinkedInAccountType.PERSON);
            credential.setAuthorUrn(urn);
            credential.setPersonUrn(urn);
            Object profileName = profile.get("name");
            credential.setDisplayName(profileName instanceof String name && !name.isBlank() ? name : "Perfil de LinkedIn");
            credential.setAccessTokenEnc(encryption.encrypt(accessToken));
            credential.setTokenIssuedAt(java.time.LocalDateTime.now());
            credential.setTokenExpiresAt(java.time.LocalDateTime.now().plusSeconds(Math.max(1, expires.longValue())));
            credential.setIsValid(true);
            credential.setIsEnabled(true);
            if (primary) credential.setIsPrimary(true);
            LinkedInCredential saved = credentials.save(credential);
            audit.recordAction(user.getTenant(), user.getEmail(), "LINKEDIN_OAUTH_CONNECTED", "Perfil personal conectado por autorización OAuth");
            return "connected";
        } catch (Exception e) {
            return "failed";
        }
    }

    @Transactional
    public String cancel(String state, String browser) {
        if (state == null || browser == null) return "failed";
        String hash = sha256(state);
        LinkedInOAuthState attempt = states.findByStateHashAndExpiresAtAfter(hash, Instant.now()).orElse(null);
        if (attempt == null || !MessageDigest.isEqual(attempt.getBrowserHash().getBytes(StandardCharsets.US_ASCII), sha256(browser).getBytes(StandardCharsets.US_ASCII))) {
            states.deleteById(hash);
            return "failed";
        }
        states.delete(attempt);
        return "cancelled";
    }

    public ResponseCookie clearCookie() {
        return ResponseCookie.from(COOKIE, "").httpOnly(true).secure(secureCookie).sameSite("Lax")
                .path("/api/v1/credentials/linkedin/oauth/callback").maxAge(0).build();
    }

    public String frontendUrl() { return frontendUrl; }
    private static String randomToken(int bytes) { byte[] value = new byte[bytes]; RANDOM.nextBytes(value); return Base64.getUrlEncoder().withoutPadding().encodeToString(value); }
    private static String sha256(String value) { try { return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); } catch (Exception e) { throw new IllegalStateException(e); } }
    private static String encode(String value) { return java.net.URLEncoder.encode(value, StandardCharsets.UTF_8); }
}
