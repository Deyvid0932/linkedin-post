package com.deyvid.backend.controller;

import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
public class HealthController {
    @GetMapping("/api/v1/health")
    public Map<String, String> health() { return Map.of("status", "UP"); }
}
