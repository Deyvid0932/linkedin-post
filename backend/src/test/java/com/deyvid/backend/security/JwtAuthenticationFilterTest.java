package com.deyvid.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.*;

class JwtAuthenticationFilterTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void authenticatesFromHttpOnlySessionCookie() throws Exception {
        JwtTokenProvider tokenProvider = mock(JwtTokenProvider.class);
        UserDetailsService users = mock(UserDetailsService.class);
        when(tokenProvider.validateToken("cookie-jwt")).thenReturn(true);
        when(tokenProvider.getUsernameFromJwt("cookie-jwt")).thenReturn("user@example.com");
        when(users.loadUserByUsername("user@example.com")).thenReturn(User.withUsername("user@example.com")
                .password("unused").authorities("ROLE_USER").build());

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("AUTOPOST_SESSION", "cookie-jwt"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        new JwtAuthenticationFilter(tokenProvider, users).doFilter(request, response, chain);

        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
        assertEquals("user@example.com", SecurityContextHolder.getContext().getAuthentication().getName());
        verify(tokenProvider).validateToken("cookie-jwt");
        verify(chain).doFilter(request, response);
    }

    @Test
    void explicitBearerTokenTakesPrecedenceOverBrowserCookie() throws Exception {
        JwtTokenProvider tokenProvider = mock(JwtTokenProvider.class);
        UserDetailsService users = mock(UserDetailsService.class);
        when(tokenProvider.validateToken("bearer-jwt")).thenReturn(true);
        when(tokenProvider.getUsernameFromJwt("bearer-jwt")).thenReturn("api@example.com");
        when(users.loadUserByUsername("api@example.com")).thenReturn(User.withUsername("api@example.com")
                .password("unused").authorities("ROLE_USER").build());

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer bearer-jwt");
        request.setCookies(new Cookie("AUTOPOST_SESSION", "cookie-jwt"));

        new JwtAuthenticationFilter(tokenProvider, users).doFilter(request, new MockHttpServletResponse(), mock(FilterChain.class));

        verify(tokenProvider).validateToken("bearer-jwt");
        verify(tokenProvider, never()).validateToken("cookie-jwt");
    }
}
