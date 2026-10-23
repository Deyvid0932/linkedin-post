package com.deyvid.backend.service;

import com.deyvid.backend.repository.ApiRequestMetricRepository;
import com.deyvid.backend.service.analytics.ApiRouteGroupClassifier;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;

@Service
public class ApiRequestMetricService {
    private static final ZoneId PLATFORM_ZONE = ZoneId.of("America/Lima");
    private final ApiRequestMetricRepository repository;

    public ApiRequestMetricService(ApiRequestMetricRepository repository) {
        this.repository = repository;
    }

    public void record(String path, int status) {
        int statusClass = status / 100;
        if (path == null || statusClass < 2 || statusClass > 5) return;
        repository.increment(LocalDate.now(PLATFORM_ZONE), ApiRouteGroupClassifier.classify(path), statusClass);
    }

    public Map<LocalDate, Map<Integer, Long>> countByDateAndStatusClass(LocalDate from, LocalDate to) {
        return repository.countByDateAndStatusClass(from, to);
    }

    public LocalDate trackingStartedOn() {
        return repository.trackingStartedOn();
    }
}
