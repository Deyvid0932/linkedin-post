package com.deyvid.backend.security;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.*;

/** Per-instance guard. An edge limiter should additionally protect public production traffic. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RequestRateLimitFilter extends OncePerRequestFilter {
    private record Window(long start, int count) {}
    private final Map<String, Window> windows = new HashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws IOException, ServletException {
        String path = req.getServletPath();
        if (!path.startsWith("/api/v1/") || req.getMethod().equals("OPTIONS") || path.equals("/api/v1/health")) { chain.doFilter(req, res); return; }
        boolean auth = path.startsWith("/api/v1/auth/");
        boolean ai = path.contains("/generate") || path.contains("/swipe-") || path.contains("/search-image") || path.endsWith("/stream");
        String group = auth ? "auth" : ai ? "ai" : "api";
        int limit = auth ? 20 : ai ? 10 : 120;
        // Never trust arbitrary X-Forwarded-For headers supplied by a client.
        String key = req.getRemoteAddr() + ":" + group;
        boolean allowed;
        long now = System.currentTimeMillis();
        synchronized (windows) {
            windows.entrySet().removeIf(e -> now - e.getValue().start() >= 60000);
            Window window = windows.getOrDefault(key, new Window(now, 0));
            allowed = window.count() < limit && (windows.containsKey(key) || windows.size() < 10000);
            if (allowed) windows.put(key, new Window(window.start(), window.count() + 1));
        }
        if (!allowed) {
            res.setStatus(429);
            res.setHeader("Retry-After", "60");
            res.setContentType("application/json");
            res.getWriter().write("{\"message\":\"Demasiadas solicitudes. Espera un minuto e intenta de nuevo.\"}");
            return;
        }
        chain.doFilter(req, res);
    }
}
