package com.deyvid.backend.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

@Repository
@RequiredArgsConstructor
public class PostgresApiHttp429MetricRepository implements ApiHttp429MetricRepository {
    private final JdbcTemplate jdbcTemplate;

    @Override
    public void increment(LocalDate date, String routeGroup) {
        jdbcTemplate.update("""
                INSERT INTO api_http_429_daily_metrics (metric_date, route_group, response_count, updated_at)
                VALUES (?, ?, 1, CURRENT_TIMESTAMP)
                ON CONFLICT (metric_date, route_group) DO UPDATE
                SET response_count = api_http_429_daily_metrics.response_count + 1,
                    updated_at = CURRENT_TIMESTAMP
                """, date, routeGroup);
    }

    @Override
    public long countSince(LocalDate from) {
        Long result = jdbcTemplate.queryForObject("""
                SELECT COALESCE(SUM(response_count), 0)
                FROM api_http_429_daily_metrics
                WHERE metric_date >= ?
                """, Long.class, from);
        return result == null ? 0 : Math.max(0, result);
    }

    @Override
    public Map<LocalDate, Map<String, Long>> countByDateAndRouteGroupSince(LocalDate from, LocalDate to) {
        var rows = jdbcTemplate.queryForList("""
                SELECT metric_date, route_group, SUM(response_count) AS response_count
                FROM api_http_429_daily_metrics
                WHERE metric_date >= ? AND metric_date <= ?
                GROUP BY metric_date, route_group
                """, from, to);
        Map<LocalDate, Map<String, Long>> counts = new HashMap<>();
        for (Map<String, Object> row : rows) {
            Object date = row.get("metric_date");
            Object group = row.get("route_group");
            Object count = row.get("response_count");
            LocalDate metricDate = date instanceof LocalDate localDate ? localDate
                    : date instanceof java.sql.Date sqlDate ? sqlDate.toLocalDate() : null;
            if (metricDate != null && group instanceof String routeGroup && count instanceof Number number) {
                counts.computeIfAbsent(metricDate, ignored -> new HashMap<>())
                        .put(routeGroup, Math.max(0, number.longValue()));
            }
        }
        Map<LocalDate, Map<String, Long>> immutableCounts = new HashMap<>();
        counts.forEach((date, groups) -> immutableCounts.put(date, Map.copyOf(groups)));
        return Map.copyOf(immutableCounts);
    }

    @Override
    public LocalDate trackingStartedOn() {
        return jdbcTemplate.queryForObject("""
                SELECT (tracking_started_at AT TIME ZONE 'America/Lima')::date
                FROM api_http_429_metric_metadata
                WHERE id = 1
                """, LocalDate.class);
    }
}
