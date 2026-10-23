package com.deyvid.backend.service;

import com.deyvid.backend.repository.ApiRequestMetricRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ApiRequestMetricServiceTest {
    @Test
    void recordsOnlyResponseClassesAndRouteGroupsWithoutRequestIdentity() {
        List<List<Object>> writes = new ArrayList<>();
        ApiRequestMetricRepository repository = new ApiRequestMetricRepository() {
            @Override public void increment(LocalDate date, String routeGroup, int statusClass) {
                writes.add(List.of(date, routeGroup, statusClass));
            }
            @Override public java.util.Map<LocalDate, java.util.Map<Integer, Long>> countByDateAndStatusClass(
                    LocalDate from, LocalDate to) { return java.util.Map.of(); }
            @Override public LocalDate trackingStartedOn() { return LocalDate.of(2026, 10, 1); }
        };
        ApiRequestMetricService service = new ApiRequestMetricService(repository);

        service.record("/api/v1/auth/login", 401);
        service.record("/api/v1/insights/daily-suggestion", 429);
        service.record("/api/v1/users", 201);
        service.record("/api/v1/users", 503);
        service.record("/api/v1/users", 101);
        service.record("/api/v1/users", 600);
        service.record(null, 500);

        LocalDate todayInLima = LocalDate.now(ZoneId.of("America/Lima"));
        assertEquals(List.of(
                List.of(todayInLima, "auth", 4),
                List.of(todayInLima, "ai", 4),
                List.of(todayInLima, "api", 2),
                List.of(todayInLima, "api", 5)), writes);
    }
}
