package com.deyvid.backend.repository;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
class PostgresApiHttp429MetricRepositoryTest {
    @Test
    void groupsRecordedResponsesByRouteWithoutCollectingRequestIdentifiers() {
        LocalDate from = LocalDate.of(2026, 10, 1);
        LocalDate to = LocalDate.of(2026, 10, 3);
        StubJdbcTemplate jdbcTemplate = new StubJdbcTemplate(List.of(
                Map.of("metric_date", java.sql.Date.valueOf(from), "route_group", "auth", "response_count", 4L),
                Map.of("metric_date", from, "route_group", "ai", "response_count", 9L),
                Map.of("metric_date", to, "route_group", "api", "response_count", 2L)));
        PostgresApiHttp429MetricRepository repository = new PostgresApiHttp429MetricRepository(jdbcTemplate);

        assertEquals(Map.of(
                from, Map.of("auth", 4L, "ai", 9L),
                to, Map.of("api", 2L)), repository.countByDateAndRouteGroupSince(from, to));
        assertTrue(jdbcTemplate.sql.contains("GROUP BY metric_date, route_group"));
        assertEquals(from, jdbcTemplate.arguments[0]);
        assertEquals(to, jdbcTemplate.arguments[1]);
    }

    @Test
    void readsTheMetricTrackingStartInThePlatformTimezone() {
        StubJdbcTemplate jdbcTemplate = new StubJdbcTemplate(List.of());
        jdbcTemplate.trackingStart = LocalDate.of(2026, 10, 17);
        PostgresApiHttp429MetricRepository repository = new PostgresApiHttp429MetricRepository(jdbcTemplate);

        assertEquals(LocalDate.of(2026, 10, 17), repository.trackingStartedOn());
        assertTrue(jdbcTemplate.sql.contains("tracking_started_at AT TIME ZONE 'America/Lima'"));
    }

    private static final class StubJdbcTemplate extends JdbcTemplate {
        private final List<Map<String, Object>> rows;
        private String sql;
        private Object[] arguments;
        private LocalDate trackingStart;

        private StubJdbcTemplate(List<Map<String, Object>> rows) {
            this.rows = rows;
        }

        @Override
        public List<Map<String, Object>> queryForList(String sql, Object... args) {
            this.sql = sql;
            this.arguments = args;
            return rows;
        }

        @Override
        public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
            this.sql = sql;
            this.arguments = args;
            return requiredType.cast(trackingStart);
        }

        @Override
        public <T> T queryForObject(String sql, Class<T> requiredType) {
            this.sql = sql;
            this.arguments = new Object[0];
            return requiredType.cast(trackingStart);
        }
    }
}
