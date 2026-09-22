package com.deyvid.backend.service;

import com.deyvid.backend.dto.response.OnboardingStatusResponse;
import com.deyvid.backend.entity.*;
import com.deyvid.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class TenantService {

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final PromptVersionRepository promptVersionRepository;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;
    private final ScheduleManagementService scheduleManagementService;
    private final LinkedInCredentialRepository linkedInCredentialRepository;
    private final GitHubRepositoryRepo gitHubRepositoryRepo;
    private final BackupTopicRepository backupTopicRepository;
    private final InterestTopicRepository interestTopicRepository;
    private final PublishingScheduleRepository publishingScheduleRepository;

    @Transactional
    public User registerUserAndTenant(String name, String email, String password) {
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("El email ya se encuentra registrado");
        }

        Tenant tenant = Tenant.builder()
                .timezone("America/Lima")
                .isActive(true)
                .isEmergencyPaused(false)
                .isDryRun(false)
                .build();

        Tenant savedTenant = tenantRepository.save(tenant);

        Role defaultRole = roleRepository.findByName("ROLE_USER")
                .orElseGet(() -> roleRepository.save(Role.builder()
                        .name("ROLE_USER")
                        .description("Usuario estándar del SaaS")
                        .build()));

        User user = User.builder()
                .name(name)
                .email(email)
                .passwordHash(passwordEncoder.encode(password))
                .roles(Set.of(defaultRole))
                .tenant(savedTenant)
                .isActive(true)
                .build();

        User savedUser = userRepository.save(user);
        auditLogService.recordAction(savedTenant, email, "REGISTER_USER", "Usuario y organización creados exitosamente");
        return savedUser;
    }

    @Transactional
    public Tenant updateTenantProfile(UUID tenantId, String userEmail, String systemPrompt, String timezone, String changeNotes) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant no encontrado"));

        boolean promptChanged = false;
        if (systemPrompt != null && !systemPrompt.equals(tenant.getSystemPrompt())) {
            tenant.setSystemPrompt(systemPrompt);
            promptChanged = true;

            // Registrar versión de prompt
            int nextVersion = promptVersionRepository.findTopByTenantIdOrderByVersionNumberDesc(tenantId)
                    .map(pv -> pv.getVersionNumber() + 1)
                    .orElse(1);

            PromptVersion pv = PromptVersion.builder()
                    .tenant(tenant)
                    .versionNumber(nextVersion)
                    .promptText(systemPrompt)
                    .changeNotes(changeNotes != null ? changeNotes : "Actualización de prompt v" + nextVersion)
                    .createdBy(userEmail)
                    .build();
            promptVersionRepository.save(pv);
            auditLogService.recordAction(tenant, userEmail, "UPDATE_PROMPT", "Prompt actualizado a versión " + nextVersion);
        }

        if (timezone != null && !timezone.isBlank()) {
            tenant.setTimezone(timezone);
            auditLogService.recordAction(tenant, userEmail, "UPDATE_TIMEZONE", "Zona horaria cambiada a " + timezone);
            scheduleManagementService.refreshAllTenantJobs(tenantId);
            notificationService.createNotification(tenant, "INFO", "Zona Horaria Actualizada",
                    "La zona horaria fue configurada a " + timezone + ". Todos los horarios activos de Quartz fueron recalculados y sincronizados.");
        }

        return tenantRepository.save(tenant);
    }

    @Transactional(readOnly = true)
    public List<PromptVersion> getPromptVersions(UUID tenantId) {
        return promptVersionRepository.findByTenantIdOrderByVersionNumberDesc(tenantId);
    }

    @Transactional
    public Tenant rollbackPromptVersion(UUID tenantId, UUID versionId, String userEmail) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant no encontrado"));

        PromptVersion targetVersion = promptVersionRepository.findById(versionId)
                .orElseThrow(() -> new IllegalArgumentException("Versión de prompt no encontrada"));

        if (!targetVersion.getTenant().getId().equals(tenantId)) {
            throw new IllegalArgumentException("Permisos insuficientes");
        }

        tenant.setSystemPrompt(targetVersion.getPromptText());

        int nextVersion = promptVersionRepository.findTopByTenantIdOrderByVersionNumberDesc(tenantId)
                .map(pv -> pv.getVersionNumber() + 1)
                .orElse(1);

        PromptVersion newVersion = PromptVersion.builder()
                .tenant(tenant)
                .versionNumber(nextVersion)
                .promptText(targetVersion.getPromptText())
                .changeNotes("Rollback a versión v" + targetVersion.getVersionNumber())
                .createdBy(userEmail)
                .build();
        promptVersionRepository.save(newVersion);

        auditLogService.recordAction(tenant, userEmail, "ROLLBACK_PROMPT", "Prompt revertido a versión v" + targetVersion.getVersionNumber() + " (nueva v" + nextVersion + ")");
        return tenantRepository.save(tenant);
    }

    @Transactional
    public Tenant setEmergencyPause(UUID tenantId, String userEmail, boolean pause) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant no encontrado"));

        tenant.setIsEmergencyPaused(pause);
        Tenant saved = tenantRepository.save(tenant);

        if (pause) {
            scheduleManagementService.pauseAllTenantSchedules(tenantId);
            auditLogService.recordAction(tenant, userEmail, "EMERGENCY_PAUSE_ON", "¡Pausa de emergencia ACTIVADA! Se suspendieron todas las publicaciones automáticas");
            notificationService.createNotification(tenant, "WARNING", "Pausa de Emergencia Activada", "Se han detenido todas las tareas programadas de publicación.");
        } else {
            scheduleManagementService.resumeAllTenantSchedules(tenantId);
            auditLogService.recordAction(tenant, userEmail, "EMERGENCY_PAUSE_OFF", "Pausa de emergencia DESACTIVADA. Horarios reactivados");
            notificationService.createNotification(tenant, "INFO", "Pausa de Emergencia Desactivada", "Los horarios de publicación se han reactivado.");
        }

        return saved;
    }

    @Transactional
    public Tenant setDryRunMode(UUID tenantId, String userEmail, boolean dryRun) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant no encontrado"));

        tenant.setIsDryRun(dryRun);
        Tenant saved = tenantRepository.save(tenant);

        auditLogService.recordAction(tenant, userEmail, "TOGGLE_DRY_RUN", "Modo Simulación (Dry-Run) configurado a: " + (dryRun ? "ACTIVADO" : "DESACTIVADO"));
        return saved;
    }

    @Transactional(readOnly = true)
    public OnboardingStatusResponse getOnboardingStatus(UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant no encontrado"));

        Optional<LinkedInCredential> liOpt = linkedInCredentialRepository.findByTenantId(tenantId);
        boolean hasLinkedIn = liOpt.isPresent() && liOpt.get().getIsValid() && liOpt.get().getTokenExpiresAt().isAfter(LocalDateTime.now());

        long reposCount = gitHubRepositoryRepo.findByTenantIdAndIsActiveTrue(tenantId).size();
        long topicsCount = backupTopicRepository.findByTenantId(tenantId).size();
        long keywordsCount = interestTopicRepository.findByTenantId(tenantId).size();
        boolean hasSources = (reposCount + topicsCount + keywordsCount) > 0;

        boolean hasSchedules = publishingScheduleRepository.findByTenantIdAndIsActiveTrue(tenantId).size() > 0;
        boolean hasPrompt = tenant.getSystemPrompt() != null && !tenant.getSystemPrompt().isBlank();

        List<OnboardingStatusResponse.OnboardingStep> steps = new ArrayList<>();
        steps.add(new OnboardingStatusResponse.OnboardingStep(
                "linkedin", "Conectar cuenta de LinkedIn",
                "Ingresa tu Access Token personal para habilitar la publicación automática.", hasLinkedIn));
        steps.add(new OnboardingStatusResponse.OnboardingStep(
                "sources", "Configurar fuentes de contenido",
                "Conecta un repositorio de GitHub o agrega temas al banco de respaldo.", hasSources));
        steps.add(new OnboardingStatusResponse.OnboardingStep(
                "schedule", "Definir horario de publicación",
                "Agrega al menos una regla de horario activa para automatizar posts.", hasSchedules));
        steps.add(new OnboardingStatusResponse.OnboardingStep(
                "prompt", "Personalizar tono y prompt de IA",
                "Define tu rol, audiencia y reglas de estilo para la generación de contenido.", hasPrompt));

        int completed = (int) steps.stream().filter(OnboardingStatusResponse.OnboardingStep::isCompleted).count();
        int total = steps.size();
        int progress = (int) Math.round(((double) completed / total) * 100);

        return new OnboardingStatusResponse(hasLinkedIn, hasSources, hasSchedules, hasPrompt, completed, total, progress, steps);
    }
}
