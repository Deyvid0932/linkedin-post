package com.deyvid.backend.service;

import com.deyvid.backend.repository.ApiHttp429MetricRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;

@Service
public class ApiHttp429MetricService {
    private static final ZoneId PLATFORM_ZONE = ZoneId.of("America/Lima");
    private final ApiHttp429MetricRepository repository;

    public ApiHttp429MetricService(ApiHttp429MetricRepository repository) {
        this.repository = repository;
    }

    public void record(String routeGroup) {
        repository.increment(LocalDate.now(PLATFORM_ZONE), routeGroup);
    }

    public long countSince(LocalDate from) {
        return repository.countSince(from);
    }

    public Map<LocalDate, Map<String, Long>> countByDateAndRouteGroup(LocalDate from, LocalDate to) {
        return repository.countByDateAndRouteGroupSince(from, to);
    }

    public LocalDate trackingStartedOn() {
        return repository.trackingStartedOn();
    }
}
