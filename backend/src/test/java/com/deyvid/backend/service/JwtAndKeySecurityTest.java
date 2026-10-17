package com.deyvid.backend.service;

import com.deyvid.backend.security.*;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class JwtAndKeySecurityTest {
    @Test void tokensMatchOnlyCurrentPasswordVersion() {
        var provider = new JwtTokenProvider("test-only-secret-over-thirty-two-bytes", 60000);
        var user = com.deyvid.backend.entity.User.builder().email("audit@example.test").passwordHash("hash").isActive(true).tokenVersion(7).build();
        var principal = new UserDetailsServiceImpl.Principal(user, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        var auth = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
        String token = provider.generateToken(auth, UUID.randomUUID());
        assertTrue(provider.validateToken(token)); assertTrue(provider.matchesVersion(token, 7));
        assertFalse(provider.matchesVersion(token, 8)); assertFalse(provider.validateToken(token + "tampered"));
    }
    @Test void legacyCompatibilityRequiresExplicitOptInAndPreservesEffectiveKey() {
        String legacy = "12345678901234567890123456789012-extra";
        assertThrows(IllegalArgumentException.class, () -> new EncryptionService(legacy));
        var compatible = new EncryptionService(legacy, true);
        var effective = new EncryptionService(legacy.substring(0, 32));
        assertEquals("stored-test-token", effective.decrypt(compatible.encrypt("stored-test-token")));
        assertThrows(IllegalArgumentException.class, () -> new EncryptionService("", true));
    }

    @Test void encryptionRejectsSilentlyTruncatedOrPaddedKeys() {
        assertThrows(IllegalArgumentException.class, () -> new EncryptionService("short"));
        assertThrows(IllegalArgumentException.class, () -> new EncryptionService("x".repeat(33)));
        var encryption = new EncryptionService("12345678901234567890123456789012");
        String encrypted = encryption.encrypt("secret-test-value");
        assertNotEquals("secret-test-value", encrypted);
        assertEquals("secret-test-value", encryption.decrypt(encrypted));
    }
}
