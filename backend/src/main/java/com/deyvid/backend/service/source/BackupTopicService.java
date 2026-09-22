package com.deyvid.backend.service.source;

import com.deyvid.backend.entity.BackupTopic;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.entity.enums.SourceMode;
import com.deyvid.backend.service.linkedin.ContentSource;
import com.deyvid.backend.repository.BackupTopicRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class BackupTopicService {

    private final BackupTopicRepository backupTopicRepository;

    /**
     * Obtiene y consume el siguiente tema para publicación real en el Pipeline (marca isUsed = true).
     * 1. Busca el primer tema con isUsed = false (no usado).
     * 2. Si todos fueron usados, recicla el tema usado hace más tiempo (menor usedAt).
     */
    @Transactional
    public Optional<ContentSource> getNextTopic(Tenant tenant) {
        log.info("Evaluando Prioridad 2 (MODO BANCO DE IDEAS) para tenant {}", tenant.getId());

        // 1. Busca el siguiente tema activo y no usado
        Optional<BackupTopic> topicOpt = backupTopicRepository
                .findFirstByTenantIdAndIsUsedFalseAndIsActiveTrueOrderByPriorityDescCreatedAtAsc(tenant.getId())
                .or(() -> backupTopicRepository.findFirstByTenantIdAndIsUsedFalseOrderByPriorityDescCreatedAtAsc(tenant.getId()));

        // 2. Si todos los temas del banco ya fueron usados, recicla el que se usó hace más tiempo
        if (topicOpt.isEmpty()) {
            topicOpt = backupTopicRepository
                    .findFirstByTenantIdAndIsActiveTrueOrderByUsedAtAscCreatedAtAsc(tenant.getId())
                    .or(() -> backupTopicRepository.findFirstByTenantIdOrderByUsedAtAscCreatedAtAsc(tenant.getId()));
            if (topicOpt.isPresent()) {
                log.info("Todos los temas del banco estaban marcados como usados. Reciclando el tema más antiguo: '{}'", topicOpt.get().getTitle());
            }
        }

        if (topicOpt.isEmpty()) {
            log.warn("No hay temas disponibles en el banco de ideas para tenant {}", tenant.getId());
            return Optional.empty();
        }

        BackupTopic topic = topicOpt.get();
        topic.setIsUsed(true);
        topic.setUsedAt(LocalDateTime.now());
        backupTopicRepository.save(topic);

        return Optional.of(mapToContentSource(topic));
    }

    /**
     * Obtiene el siguiente tema para previsualización en el Estudio sin marcarlo inmediatamente,
     * priorizando estrictamente los temas NO USADOS (isUsed = false).
     * Si todos ya fueron usados, rota al usado hace más tiempo.
     */
    @Transactional(readOnly = true)
    public Optional<ContentSource> previewNextTopic(Tenant tenant) {
        // 1. Prioridad absoluta a temas no usados
        Optional<BackupTopic> topicOpt = backupTopicRepository
                .findFirstByTenantIdAndIsUsedFalseAndIsActiveTrueOrderByPriorityDescCreatedAtAsc(tenant.getId())
                .or(() -> backupTopicRepository.findFirstByTenantIdAndIsUsedFalseOrderByPriorityDescCreatedAtAsc(tenant.getId()));

        // 2. Solo si TODOS fueron usados, rota al más antiguo
        if (topicOpt.isEmpty()) {
            topicOpt = backupTopicRepository
                    .findFirstByTenantIdAndIsActiveTrueOrderByUsedAtAscCreatedAtAsc(tenant.getId())
                    .or(() -> backupTopicRepository.findFirstByTenantIdOrderByUsedAtAscCreatedAtAsc(tenant.getId()));
        }

        return topicOpt.map(this::mapToContentSource);
    }

    /**
     * Marca un tema como investigado y utilizado, registrando la fecha/hora actual (used_at).
     * Si el tema proviene del Estudio / IA y no existía previamente en el banco, se registra automáticamente.
     */
    @Transactional
    public void markTopicAsUsed(Tenant tenant, String topicTitle) {
        if (tenant == null || tenant.getId() == null || topicTitle == null || topicTitle.isBlank()) {
            return;
        }

        String cleanTitle = topicTitle.trim();
        Optional<BackupTopic> topicOpt = findMatchingTopic(tenant, cleanTitle);

        if (topicOpt.isPresent()) {
            BackupTopic topic = topicOpt.get();
            topic.setIsUsed(true);
            topic.setUsedAt(LocalDateTime.now());
            backupTopicRepository.save(topic);
            log.info("✅ Tema existente del Banco de Ideas marcado como INVESTIGADO (usedAt: {}): '{}'", topic.getUsedAt(), topic.getTitle());
        } else {
            BackupTopic newTopic = BackupTopic.builder()
                    .tenant(tenant)
                    .title(cleanTitle)
                    .description("Tema investigado y procesado desde el Estudio de Contenido")
                    .category(detectCategory(cleanTitle))
                    .isAiResearch(true)
                    .isActive(true)
                    .isUsed(true)
                    .usedAt(LocalDateTime.now())
                    .priority(0)
                    .build();
            backupTopicRepository.save(newTopic);
            log.info("✨ Nuevo tema registrado automáticamente en el Banco de Ideas como INVESTIGADO: '{}'", cleanTitle);
        }
    }

    public static String detectCategory(String title) {
        if (title == null) return "General Tech";
        String t = title.toLowerCase();
        if (t.matches(".*\\b(flutter|react native|android|ios|swift|swiftui|kotlin|mobile|dart|apk|xcode)\\b.*")) {
            return "Móvil & Apps";
        }
        if (t.matches(".*\\b(angular|react|vue|svelte|tailwind|css|html|typescript|javascript|next\\.js|nuxt|vite|ui|ux|frontend|signals|rxjs)\\b.*")) {
            return "Frontend Web";
        }
        if (t.matches(".*\\b(spring|java|spring boot|node|nodejs|express|python|fastapi|django|golang|go|docker|kubernetes|k8s|aws|microservicios|microservices|rest|api|grpc|kafka|rabbitmq|virtual threads)\\b.*")) {
            return "Backend & Cloud";
        }
        if (t.matches(".*\\b(sql|mysql|postgres|postgresql|mongodb|redis|database|queries|query|jpa|hibernate|orm|índice|indices|dax|power bi|nosql)\\b.*")) {
            return "Base de Datos";
        }
        if (t.matches(".*\\b(jwt|oauth|oauth2|seguridad|security|ciberseguridad|owasp|auth|encriptación|encryption|zero trust|vulnerabilidad|tokens|penetration|pentesting)\\b.*")) {
            return "Ciberseguridad";
        }
        if (t.matches(".*\\b(arquitectura|architecture|clean code|clean architecture|patrones|design patterns|junior|senior|tech lead|carrera|entrevista|entrevistas|git|github|ci/cd|devops)\\b.*")) {
            return "Arquitectura & Carrera";
        }
        return "General Tech";
    }

    private Optional<BackupTopic> findMatchingTopic(Tenant tenant, String topicTitle) {
        if (tenant == null || tenant.getId() == null || topicTitle == null || topicTitle.isBlank()) {
            return Optional.empty();
        }

        String cleanTitle = topicTitle.trim();

        // 1. Buscar por título exacto
        Optional<BackupTopic> topicOpt = backupTopicRepository.findFirstByTenantIdAndTitleIgnoreCase(tenant.getId(), cleanTitle);

        // 2. Si no coincide exacto, buscar por contención
        if (topicOpt.isEmpty() && cleanTitle.length() >= 5) {
            topicOpt = backupTopicRepository.findFirstByTenantIdAndTitleContainingIgnoreCase(tenant.getId(), cleanTitle);
        }

        // 3. Buscar si el título de DB está contenido en cleanTitle o viceversa
        if (topicOpt.isEmpty()) {
            List<BackupTopic> allTenantTopics = backupTopicRepository.findByTenantId(tenant.getId());
            for (BackupTopic bt : allTenantTopics) {
                if (bt.getTitle() != null && !bt.getTitle().isBlank()) {
                    String btLower = bt.getTitle().trim().toLowerCase();
                    String cleanLower = cleanTitle.toLowerCase();
                    if (cleanLower.contains(btLower) || btLower.contains(cleanLower)) {
                        return Optional.of(bt);
                    }
                }
            }
        }

        return topicOpt;
    }

    private ContentSource mapToContentSource(BackupTopic topic) {
        boolean isAiResearch = Boolean.TRUE.equals(topic.getIsAiResearch());
        return new ContentSource(
                isAiResearch ? SourceMode.RESEARCH : SourceMode.BACKUP,
                topic.getTitle(),
                topic.getDescription() != null && !topic.getDescription().isBlank()
                        ? topic.getDescription()
                        : "Análisis técnico y aplicación práctica sobre " + topic.getTitle(),
                null,
                isAiResearch ? "https://spring.io/blog" : "IdeaID: " + topic.getId()
        );
    }
}
