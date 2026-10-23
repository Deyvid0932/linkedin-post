package com.deyvid.backend.repository;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PostgresApiRequestMetricRepositoryTest {
    @Test
    void aggregatesStatusClassesWithoutStoringRequestDetails() {
        LocalDate from = LocalDate.of(2026, 10, 1);
        LocalDate to = LocalDate.of(2026, 10, 2);
        StubJdbcTemplate jdbc = new StubJdbcTemplate(List.of(
                Map.of("metric_date", java.sql.Date.valueOf(from), "status_class", 2, "request_count", 12L),
                Map.of("metric_date", to, "status_class", 4, "request_count", 3L),
                Map.of("metric_date", to, "status_class", 6, "request_count", 99L)));
        PostgresApiRequestMetricRepository repository = new PostgresApiRequestMetricRepository(jdbc);

        assertEquals(Map.of(from, Map.of(2, 12L), to, Map.of(4, 3L)),
                repository.countByDateAndStatusClass(from, to));
        assertTrue(jdbc.sql.contains("GROUP BY metric_date, status_class"));
        assertTrue(!jdbc.sql.contains("request_path") && !jdbc.sql.contains("user_id") && !jdbc.sql.contains("ip_address"));
        assertEquals(from, jdbc.arguments[0]);
        assertEquals(to, jdbc.arguments[1]);
    }

    @Test
    void tagsTheTrackingStartDateInThePlatformTimeZone() {
        LocalDate startedOn = LocalDate.of(2026, 10, 17);
        StubJdbcTemplate jdbc = new StubJdbcTemplate(List.of());
        jdbc.startedOn = startedOn;
        PostgresApiRequestMetricRepository repository = new PostgresApiRequestMetricRepository(jdbc);

        assertEquals(startedOn, repository.trackingStartedOn());
        assertTrue(jdbc.sql.contains("AT TIME ZONE 'America/Lima'"));
    }

    private static final class StubJdbcTemplate extends JdbcTemplate {
        private final List<Map<String, Object>> rows;
        private String sql;
        private Object[] arguments;
        private LocalDate startedOn;

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
        public <T> T queryForObject(String sql, Class<T> requiredType) {
            this.sql = sql;
            return requiredType.cast(startedOn);
        }
    }
}
