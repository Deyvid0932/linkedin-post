package com.deyvid.backend.job;

import com.deyvid.backend.service.pipeline.ContentPipelineService;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.quartz.JobDataMap;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.quartz.QuartzJobBean;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@NoArgsConstructor
@AllArgsConstructor
@Slf4j
public class ContentPublicationJob extends QuartzJobBean {

    @Autowired
    private ContentPipelineService contentPipelineService;

    @Override
    protected void executeInternal(JobExecutionContext context) throws JobExecutionException {
        long startTime = System.currentTimeMillis();
        JobDataMap dataMap = context.getMergedJobDataMap();
        String tenantIdStr = dataMap.getString("tenantId");

        String triggerKey = context.getTrigger() != null ? context.getTrigger().getKey().toString() : "N/A";
        String fireTime = java.time.LocalDateTime.now().toString();

        log.info("╔═══════════════════════════════════════════════════════════════════════════════════════╗");
        log.info("║ ⏰ [QUARTZ TRIGGER DISPARADO] Horario programado activado en punto                     ║");
        log.info("║ - Trigger: {}                                                                          ", triggerKey);
        log.info("║ - Tenant ID: {}                                                                        ", tenantIdStr);
        log.info("║ - Hora Local: {}                                                                       ", fireTime);
        log.info("╚═══════════════════════════════════════════════════════════════════════════════════════╝");

        if (tenantIdStr == null || tenantIdStr.isBlank()) {
            log.error("❌ [QUARTZ ERROR] Abortando ejecución: 'tenantId' no está presente en JobDataMap");
            return;
        }

        UUID tenantId;
        try {
            tenantId = UUID.fromString(tenantIdStr);
        } catch (IllegalArgumentException e) {
            log.error("❌ [QUARTZ ERROR] 'tenantId' inválido: {}", tenantIdStr);
            return;
        }

        try {
            log.info("🚀 [QUARTZ PIPELINE] Iniciando pipeline de publicación automática para Tenant: {}", tenantId);
            contentPipelineService.executePipelineForTenant(tenantId);
            long duration = System.currentTimeMillis() - startTime;
            log.info("✅ [QUARTZ COMPLETADO] Publicación automática finalizada con éxito para Tenant {} en {} ms", tenantId, duration);
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("❌ [QUARTZ ERROR] Error ejecutando pipeline para tenant {} tras {} ms: {}", tenantId, duration, e.getMessage(), e);
            throw new JobExecutionException(e);
        }
    }
}
