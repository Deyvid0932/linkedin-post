package com.deyvid.backend.service;

import com.deyvid.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.quartz.CronExpression;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.time.*;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AutomationService {
    private final PublishingScheduleRepository schedules;
    private final TenantRepository tenants;
    private final ApprovedPublicationService publisher;
    private final JdbcTemplate jdbc;

    public record RunResult(int processed, int published, int reviewRequired) {}

    public RunResult runDue(UUID tenantId, Instant now) {
        var tenant = tenants.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("Cuenta de automatización no disponible"));
        if (Boolean.TRUE.equals(tenant.getIsEmergencyPaused()) || !Boolean.TRUE.equals(tenant.getIsActive())) return new RunResult(0, 0, 0);
        int processed = 0, published = 0, review = 0;
        for (var schedule : schedules.findByTenantIdAndIsActiveTrue(tenantId)) {
            try {
                CronExpression cron = new CronExpression(schedule.getCronExpression());
                cron.setTimeZone(TimeZone.getTimeZone(ZoneId.of(tenant.getTimezone())));
                // Bounded catch-up; do not publish hours of missed posts in a burst.
                Date fire = cron.getNextValidTimeAfter(Date.from(now.minus(Duration.ofMinutes(20))));
                if (fire == null || fire.toInstant().isAfter(now)) continue;
                // Choose the latest due slot, never replay every missed slot in a burst.
                for (int i = 0; i < 1200; i++) {
                    Date next = cron.getNextValidTimeAfter(fire);
                    if (next == null || next.toInstant().isAfter(now)) break;
                    fire = next;
                }
                var fireAt = OffsetDateTime.ofInstant(fire.toInstant(), ZoneOffset.UTC);
                int claimed = jdbc.update("INSERT INTO automation_runs (schedule_id, fire_at) VALUES (?, ?) ON CONFLICT (schedule_id, fire_at) DO NOTHING", schedule.getId(), fireAt);
                if (claimed == 0) continue;
                processed++;
                try {
                    var result = publisher.publish(tenantId, null);
                    published += result.publishedCount();
                    boolean needsReview = Set.of("REVIEW_REQUIRED", "NO_ACCOUNT").contains(result.outcome());
                    if (needsReview) review++;
                    jdbc.update("UPDATE automation_runs SET status = ? WHERE schedule_id = ? AND fire_at = ?",
                            needsReview ? "REVIEW_REQUIRED" : "COMPLETED", schedule.getId(), fireAt);
                } catch (Exception e) {
                    review++;
                    jdbc.update("UPDATE automation_runs SET status = 'FAILED' WHERE schedule_id = ? AND fire_at = ?", schedule.getId(), fireAt);
                }
            } catch (java.text.ParseException | java.time.DateTimeException e) {
                review++;
            }
        }
        return new RunResult(processed, published, review);
    }
}
