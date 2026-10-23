package com.deyvid.backend.security;

import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertTrue;

class SessionCookieFactoryTest {

    @Test
    void issuesHttpOnlySecureSameSiteSessionCookie() {
        String cookie = new SessionCookieFactory(true).issue("jwt-value", Duration.ofHours(24)).toString();

        assertTrue(cookie.startsWith("AUTOPOST_SESSION=jwt-value"));
        assertTrue(cookie.contains("Path=/api/v1"));
        assertTrue(cookie.contains("Max-Age=86400"));
        assertTrue(cookie.contains("HttpOnly"));
        assertTrue(cookie.contains("Secure"));
        assertTrue(cookie.contains("SameSite=Lax"));
    }

    @Test
    void expiresCookieWithTheSamePathAndSecurityAttributes() {
        String cookie = new SessionCookieFactory(true).expire().toString();

        assertTrue(cookie.startsWith("AUTOPOST_SESSION="));
        assertTrue(cookie.contains("Path=/api/v1"));
        assertTrue(cookie.contains("Max-Age=0"));
        assertTrue(cookie.contains("HttpOnly"));
        assertTrue(cookie.contains("Secure"));
        assertTrue(cookie.contains("SameSite=Lax"));
    }
}
