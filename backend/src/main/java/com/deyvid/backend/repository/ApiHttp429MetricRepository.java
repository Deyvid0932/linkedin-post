package com.deyvid.backend.repository;

import java.time.LocalDate;
import java.util.Map;

public interface ApiHttp429MetricRepository {
    void increment(LocalDate date, String routeGroup);

    long countSince(LocalDate from);

    Map<LocalDate, Map<String, Long>> countByDateAndRouteGroupSince(LocalDate from, LocalDate to);

    LocalDate trackingStartedOn();
}
