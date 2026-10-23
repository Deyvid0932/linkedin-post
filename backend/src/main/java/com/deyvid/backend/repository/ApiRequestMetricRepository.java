package com.deyvid.backend.repository;

import java.time.LocalDate;
import java.util.Map;

public interface ApiRequestMetricRepository {
    void increment(LocalDate date, String routeGroup, int statusClass);

    Map<LocalDate, Map<Integer, Long>> countByDateAndStatusClass(LocalDate from, LocalDate to);

    LocalDate trackingStartedOn();
}
