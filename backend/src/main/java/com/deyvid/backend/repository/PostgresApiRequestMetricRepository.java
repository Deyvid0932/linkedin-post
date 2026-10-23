package com.deyvid.backend.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

@Repository
@RequiredArgsConstructor
public class PostgresApiRequestMetricRepository implements ApiRequestMetricRepository {
    private final JdbcTemplate jdbcTemplate;

    @Override
    public void increment(LocalDate date, String routeGroup, int statusClass) {
        jdbcTemplate.update("""
                INSERT INTO api_request_daily_metrics (metric_date, route_group, status_class, request_count, updated_at)
                VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
                ON CONFLICT (metric_date, route_group, status_class) DO UPDATE
                SET request_count = api_request_daily_metrics.request_count + 1,
                    updated_at = CURRENT_TIMESTAMP
                """, date, routeGroup, statusClass);
    }

    @Override
    public Map<LocalDate, Map<Integer, Long>> countByDateAndStatusClass(LocalDate from, LocalDate to) {
        var rows = jdbcTemplate.queryForList("""
                SELECT metric_date, status_class, SUM(request_count) AS request_count
                FROM api_request_daily_metrics
                WHERE metric_date >= ? AND metric_date <= ?
                GROUP BY metric_date, status_class
                """, from, to);
        Map<LocalDate, Map<Integer, Long>> counts = new HashMap<>();
        for (Map<String, Object> row : rows) {
            Object rawDate = row.get("metric_date");
            Object rawStatusClass = row.get("status_class");
            Object rawCount = row.get("request_count");
            LocalDate date = rawDate instanceof LocalDate localDate ? localDate
                    : rawDate instanceof Date sqlDate ? sqlDate.toLocalDate() : null;
            if (date != null && rawStatusClass instanceof Number status && rawCount instanceof Number count) {
                int statusClass = status.intValue();
                if (statusClass >= 2 && statusClass <= 5) {
                    counts.computeIfAbsent(date, ignored -> new HashMap<>())
                            .put(statusClass, Math.max(0, count.longValue()));
                }
            }
        }
        Map<LocalDate, Map<Integer, Long>> immutableCounts = new HashMap<>();
        counts.forEach((date, classes) -> immutableCounts.put(date, Map.copyOf(classes)));
        return Map.copyOf(immutableCounts);
    }

    @Override
    public LocalDate trackingStartedOn() {
        return jdbcTemplate.queryForObject("""
                SELECT (tracking_started_at AT TIME ZONE 'America/Lima')::date
                FROM api_request_metric_metadata
                WHERE id = 1
                """, LocalDate.class);
    }
}
