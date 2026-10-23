package com.deyvid.backend.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
public class SessionCookieFactory {
    public static final String COOKIE_NAME = "AUTOPOST_SESSION";
    private static final String COOKIE_PATH = "/api/v1";

    private final boolean secure;

    public SessionCookieFactory(@Value("${app.security.session-cookie-secure:true}") boolean secure) {
        this.secure = secure;
    }

    public ResponseCookie issue(String jwt, Duration maxAge) {
        return ResponseCookie.from(COOKIE_NAME, jwt)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Lax")
                .path(COOKIE_PATH)
                .maxAge(maxAge)
                .build();
    }

    public ResponseCookie expire() {
        return issue("", Duration.ZERO);
    }
}
