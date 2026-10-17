package com.deyvid.backend.controller;

import com.deyvid.backend.service.LinkedInOAuthService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URI;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/credentials/linkedin/oauth")
@RequiredArgsConstructor
public class LinkedInOAuthController {
    private final LinkedInOAuthService oauth;

    @PostMapping("/start")
    public ResponseEntity<Map<String, String>> start(Authentication principal) {
        var result = oauth.start(principal);
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, result.browserCookie().toString())
                .body(Map.of("authorizationUrl", result.authorizationUrl()));
    }

    @GetMapping("/callback")
    public void callback(@RequestParam(required = false) String code,
                         @RequestParam(required = false) String state,
                         @RequestParam(required = false) String error,
                         @CookieValue(name = "autopost_linkedin_oauth", required = false) String browser,
                         HttpServletResponse response) throws IOException {
        String result = error == null ? oauth.complete(state, browser, code) : oauth.cancel(state, browser);
        response.addHeader(HttpHeaders.SET_COOKIE, oauth.clearCookie().toString());
        String frontend = oauth.frontendUrl().replaceAll("/+$", "");
        response.sendRedirect(URI.create(frontend + "/settings/linkedin?linkedin_oauth=" + result).toString());
    }
}
