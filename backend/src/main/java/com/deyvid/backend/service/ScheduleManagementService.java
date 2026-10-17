package com.deyvid.backend.service;

import com.deyvid.backend.entity.PublishingSchedule;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.job.ContentPublicationJob;
import com.deyvid.backend.repository.PublishingScheduleRepository;
import com.deyvid.backend.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.quartz.*;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.TimeZone;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScheduleManagementService {

    @org.springframework.beans.factory.annotation.Value("${app.scheduler.mode:quartz}")
    private String schedulerMode;

    private final Scheduler scheduler;
    private final PublishingScheduleRepository scheduleRepository;
    private final TenantRepository tenantRepository;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void syncAllActiveSchedulesOnStartup() {
        if (!"quartz".equals(schedulerMode)) return;
        log.info("Sincronizando horarios activos de PostgreSQL con Quartz Scheduler al arrancar el servidor...");
        List<PublishingSchedule> activeSchedules = scheduleRepository.findAll().stream()
                .filter(s -> Boolean.TRUE.equals(s.getIsActive()))
                .toList();

        for (PublishingSchedule schedule : activeSchedules) {
            registerQuartzJob(schedule);
        }
        log.info("Se cargaron y registraron {} horarios activos en Quartz Scheduler exitosamente.", activeSchedules.size());
    }

    public static String normalizeCronExpression(String cron) {
        if (cron == null || cron.isBlank()) return cron;
        String[] parts = cron.trim().split("\\s+");
        if (parts.length >= 6) {
            try {
                int sec = Integer.parseInt(parts[0]);
                int min = Integer.parseInt(parts[1]);
                int hour = Integer.parseInt(parts[2]);
                parts[0] = String.valueOf(sec);
                parts[1] = String.valueOf(min);
                parts[2] = String.valueOf(hour);
                return String.join(" ", parts);
            } catch (NumberFormatException ignored) {
            }
        }
        return cron.trim();
    }

    @Transactional
    public PublishingSchedule createSchedule(Tenant tenant, String userEmail, String cronExpression, String description) {
        UUID tenantId = tenant != null ? tenant.getId() : null;
        Tenant managedTenant = tenantId != null ? tenantRepository.findById(tenantId).orElse(tenant) : tenant;
        String cleanCron = normalizeCronExpression(cronExpression);
        if (!org.quartz.CronExpression.isValidExpression(cleanCron)) throw new IllegalArgumentException("Expresión cron inválida");
        PublishingSchedule schedule = PublishingSchedule.builder()
                .tenant(managedTenant)
                .cronExpression(cleanCron)
                .description(description)
                .isActive(true)
                .build();

        try {
            PublishingSchedule saved = scheduleRepository.save(schedule);
            registerQuartzJob(saved);
            auditLogService.recordAction(managedTenant, userEmail, "CREATE_SCHEDULE", "Horario creado: " + cleanCron + " (" + description + ")");
            return saved;
        } catch (Exception e) {
            log.error("Error guardando horario para tenant: {} con cron: {}", tenantId, cleanCron, e);
            throw new RuntimeException("No se pudo registrar el horario en Quartz o Base de Datos: " + e.getMessage(), e);
        }
    }

    @Transactional
    public PublishingSchedule updateSchedule(UUID scheduleId, UUID tenantId, String userEmail, String cronExpression, String description) {
        PublishingSchedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new IllegalArgumentException("Horario no encontrado"));

        if (!schedule.getTenant().getId().equals(tenantId)) {
            throw new IllegalArgumentException("No tienes permisos sobre este horario");
        }

        String cleanCron = normalizeCronExpression(cronExpression);
        if (!org.quartz.CronExpression.isValidExpression(cleanCron)) throw new IllegalArgumentException("Expresión cron inválida");
        schedule.setCronExpression(cleanCron);
        schedule.setDescription(description);
        PublishingSchedule saved = scheduleRepository.save(schedule);

        if (Boolean.TRUE.equals(saved.getIsActive())) {
            registerQuartzJob(saved);
        }

        auditLogService.recordAction(schedule.getTenant(), userEmail, "UPDATE_SCHEDULE", "Horario actualizado: " + cleanCron);
        return saved;
    }

    @Transactional
    public PublishingSchedule toggleSchedule(UUID scheduleId, UUID tenantId, String userEmail) {
        PublishingSchedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new IllegalArgumentException("Horario no encontrado"));

        if (!schedule.getTenant().getId().equals(tenantId)) {
            throw new IllegalArgumentException("No tienes permisos sobre este horario");
        }

        boolean newActive = !Boolean.TRUE.equals(schedule.getIsActive());
        schedule.setIsActive(newActive);
        PublishingSchedule saved = scheduleRepository.save(schedule);

        if (newActive) {
            registerQuartzJob(saved);
        } else {
            unregisterQuartzJob(saved);
        }

        auditLogService.recordAction(schedule.getTenant(), userEmail, "TOGGLE_SCHEDULE", "Horario ID " + scheduleId + " marcado como " + (newActive ? "ACTIVO" : "PAUSADO"));
        return saved;
    }

    @Transactional(readOnly = true)
    public List<PublishingSchedule> getSchedulesByTenant(UUID tenantId) {
        return scheduleRepository.findByTenantId(tenantId);
    }

    @Transactional
    public void deleteSchedule(UUID scheduleId, UUID tenantId, String userEmail) {
        PublishingSchedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new IllegalArgumentException("Horario no encontrado"));

        if (!schedule.getTenant().getId().equals(tenantId)) {
            throw new IllegalArgumentException("No tienes permisos sobre este horario");
        }

        unregisterQuartzJob(schedule);
        scheduleRepository.delete(schedule);
        auditLogService.recordAction(schedule.getTenant(), userEmail, "DELETE_SCHEDULE", "Horario eliminado: " + schedule.getCronExpression());
    }

    @Transactional
    public void refreshAllTenantJobs(UUID tenantId) {
        List<PublishingSchedule> activeSchedules = scheduleRepository.findByTenantIdAndIsActiveTrue(tenantId);
        for (PublishingSchedule schedule : activeSchedules) {
            registerQuartzJob(schedule);
        }
        log.info("Se re-sincronizaron {} horarios de Quartz para el tenant ID {}", activeSchedules.size(), tenantId);
    }

    @Transactional
    public void pauseAllTenantSchedules(UUID tenantId) {
        List<PublishingSchedule> list = scheduleRepository.findByTenantIdAndIsActiveTrue(tenantId);
        for (PublishingSchedule schedule : list) {
            unregisterQuartzJob(schedule);
        }
        log.info("Todos los jobs de Quartz pausados para el tenant {}", tenantId);
    }

    @Transactional
    public void resumeAllTenantSchedules(UUID tenantId) {
        List<PublishingSchedule> list = scheduleRepository.findByTenantIdAndIsActiveTrue(tenantId);
        for (PublishingSchedule schedule : list) {
            registerQuartzJob(schedule);
        }
        log.info("Todos los jobs de Quartz reactivados para el tenant {}", tenantId);
    }

    public void registerQuartzJob(PublishingSchedule schedule) {
        if (!"quartz".equals(schedulerMode)) return;
        try {
            UUID tenantId = schedule.getTenant() != null ? schedule.getTenant().getId() : null;
            Tenant tenant = tenantId != null ? tenantRepository.findById(tenantId).orElse(schedule.getTenant()) : schedule.getTenant();

            JobKey jobKey = JobKey.jobKey("PublicationJob_" + schedule.getId(), "TenantGroup_" + (tenantId != null ? tenantId : "global"));
            TriggerKey triggerKey = TriggerKey.triggerKey("Trigger_" + schedule.getId(), "TenantGroup_" + (tenantId != null ? tenantId : "global"));

            JobDetail jobDetail = JobBuilder.newJob(ContentPublicationJob.class)
                    .withIdentity(jobKey)
                    .usingJobData("tenantId", tenantId != null ? tenantId.toString() : "")
                    .storeDurably()
                    .build();

            String tzId = (tenant != null && tenant.getTimezone() != null && !tenant.getTimezone().isBlank())
                    ? tenant.getTimezone()
                    : "America/Lima";
            TimeZone timeZone = TimeZone.getTimeZone(tzId);

            String cleanCron = normalizeCronExpression(schedule.getCronExpression());

            CronTrigger trigger = TriggerBuilder.newTrigger()
                    .withIdentity(triggerKey)
                    .withSchedule(CronScheduleBuilder.cronSchedule(cleanCron)
                            .inTimeZone(timeZone)
                            .withMisfireHandlingInstructionDoNothing())
                    .build();

            if (scheduler.checkExists(jobKey)) {
                scheduler.deleteJob(jobKey);
            }

            java.util.Date nextFireDate = scheduler.scheduleJob(jobDetail, trigger);
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
            sdf.setTimeZone(timeZone);
            String nextFireFormatted = nextFireDate != null ? sdf.format(nextFireDate) : "Indeterminado";

            log.info("⏰ [QUARTZ REGISTRADO] Job ID: {} (Cron: {}) en TimeZone {}. Próximo disparo programado: {} ({})",
                    schedule.getId(), cleanCron, tzId, nextFireFormatted, tzId);

            if (tenant != null) {
                notificationService.createNotification(
                        tenant,
                        "INFO",
                        "Horario Quartz Activo",
                        "Horario programado: " + cleanCron + " en zona " + tzId + ". Próximo disparo: " + nextFireFormatted + " (" + (schedule.getDescription() != null ? schedule.getDescription() : "Programado") + ")"
                );
            }
        } catch (SchedulerException e) {
            log.error("Error al registrar job en Quartz: {}", e.getMessage(), e);
        }
    }

    @Transactional
    public void triggerNow(UUID scheduleId, UUID tenantId, String userEmail) {
        PublishingSchedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new IllegalArgumentException("Horario no encontrado"));

        if (!schedule.getTenant().getId().equals(tenantId)) {
            throw new IllegalArgumentException("No tienes permisos sobre este horario");
        }

        try {
            JobKey jobKey = JobKey.jobKey("PublicationJob_" + schedule.getId(), "TenantGroup_" + schedule.getTenant().getId());
            if (!scheduler.checkExists(jobKey)) {
                registerQuartzJob(schedule);
            }
            scheduler.triggerJob(jobKey);
            auditLogService.recordAction(schedule.getTenant(), userEmail, "TRIGGER_SCHEDULE_NOW", "Disparo manual forzado para horario ID: " + scheduleId);
            log.info("Job disparado manualmente para horario ID: {}", scheduleId);
        } catch (SchedulerException e) {
            log.error("Error al disparar job manualmente en Quartz: {}", e.getMessage(), e);
            throw new RuntimeException("Error al disparar el job en Quartz: " + e.getMessage());
        }
    }

    private void unregisterQuartzJob(PublishingSchedule schedule) {
        try {
            JobKey jobKey = JobKey.jobKey("PublicationJob_" + schedule.getId(), "TenantGroup_" + schedule.getTenant().getId());
            if (scheduler.checkExists(jobKey)) {
                scheduler.deleteJob(jobKey);
                log.info("Quartz job eliminado/pausado para horario ID: {}", schedule.getId());
            }
        } catch (SchedulerException e) {
            log.error("Error al eliminar job de Quartz: {}", e.getMessage(), e);
        }
    }
}
