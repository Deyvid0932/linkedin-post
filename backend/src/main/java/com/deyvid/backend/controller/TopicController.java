package com.deyvid.backend.controller;

import com.deyvid.backend.dto.request.BackupTopicRequest;
import com.deyvid.backend.dto.request.BulkTopicRequests;
import com.deyvid.backend.dto.request.InterestTopicRequest;
import com.deyvid.backend.entity.BackupTopic;
import com.deyvid.backend.entity.InterestTopic;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.repository.BackupTopicRepository;
import com.deyvid.backend.repository.InterestTopicRepository;
import com.deyvid.backend.security.AuthHelper;
import com.deyvid.backend.service.AuditLogService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1/topics")
@RequiredArgsConstructor
public class TopicController {

    private final AuthHelper authHelper;
    private final BackupTopicRepository backupTopicRepository;
    private final InterestTopicRepository interestTopicRepository;
    private final AuditLogService auditLogService;

    @GetMapping
    public ResponseEntity<List<BackupTopic>> getUnifiedTopics(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        return ResponseEntity.ok(backupTopicRepository.findByTenantIdOrderByPriorityDescCreatedAtAsc(user.getTenant().getId()));
    }

    @PostMapping
    public ResponseEntity<BackupTopic> addTopic(Authentication auth, @Valid @RequestBody BackupTopicRequest request) {
        User user = authHelper.getCurrentUser(auth);
        boolean isAi = Boolean.TRUE.equals(request.isAiResearch());

        BackupTopic topic = BackupTopic.builder()
                .tenant(user.getTenant())
                .title(request.title().trim())
                .description(request.description())
                .category(request.category() != null && !request.category().isBlank() ? request.category().trim() : (isAi ? "Investigación IA" : "General"))
                .isAiResearch(isAi)
                .isActive(request.isActive() != null ? request.isActive() : true)
                .priority(request.priority() != null ? request.priority() : 0)
                .isUsed(false)
                .build();

        BackupTopic saved = backupTopicRepository.save(topic);
        auditLogService.recordAction(user.getTenant(), user.getEmail(), "ADD_TOPIC",
                "Tema agregado (" + (isAi ? "Investigación IA" : "Tema Fijo") + "): " + request.title());
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<BackupTopic> updateTopic(
            Authentication auth,
            @PathVariable UUID id,
            @Valid @RequestBody BackupTopicRequest request) {
        User user = authHelper.getCurrentUser(auth);
        BackupTopic topic = backupTopicRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Tema no encontrado"));

        if (!topic.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes");
        }

        topic.setTitle(request.title().trim());
        topic.setDescription(request.description());
        if (request.category() != null) topic.setCategory(request.category().trim());
        if (request.isAiResearch() != null) topic.setIsAiResearch(request.isAiResearch());
        if (request.isActive() != null) topic.setIsActive(request.isActive());
        if (request.priority() != null) topic.setPriority(request.priority());

        BackupTopic saved = backupTopicRepository.save(topic);
        auditLogService.recordAction(user.getTenant(), user.getEmail(), "UPDATE_TOPIC", "Tema actualizado: " + saved.getTitle());
        return ResponseEntity.ok(saved);
    }

    @PatchMapping("/{id}/toggle-type")
    public ResponseEntity<BackupTopic> toggleTopicType(Authentication auth, @PathVariable UUID id) {
        User user = authHelper.getCurrentUser(auth);
        BackupTopic topic = backupTopicRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Tema no encontrado"));

        if (!topic.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes");
        }

        boolean nextVal = !Boolean.TRUE.equals(topic.getIsAiResearch());
        topic.setIsAiResearch(nextVal);
        BackupTopic saved = backupTopicRepository.save(topic);

        auditLogService.recordAction(user.getTenant(), user.getEmail(), "TOGGLE_TOPIC_TYPE",
                "Tipo cambiado a " + (nextVal ? "Investigación IA" : "Tema Fijo Curado") + " para: " + topic.getTitle());
        return ResponseEntity.ok(saved);
    }

    @PatchMapping("/{id}/toggle-status")
    public ResponseEntity<BackupTopic> toggleTopicStatus(Authentication auth, @PathVariable UUID id) {
        User user = authHelper.getCurrentUser(auth);
        BackupTopic topic = backupTopicRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Tema no encontrado"));

        if (!topic.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes");
        }

        boolean nextVal = !Boolean.TRUE.equals(topic.getIsActive());
        topic.setIsActive(nextVal);
        BackupTopic saved = backupTopicRepository.save(topic);

        auditLogService.recordAction(user.getTenant(), user.getEmail(), "TOGGLE_TOPIC_STATUS",
                "Estado cambiado a " + (nextVal ? "Activo" : "Pausado") + " para: " + topic.getTitle());
        return ResponseEntity.ok(saved);
    }

    @PatchMapping("/{id}/reset-used")
    public ResponseEntity<BackupTopic> resetUsedTopic(Authentication auth, @PathVariable UUID id) {
        User user = authHelper.getCurrentUser(auth);
        BackupTopic topic = backupTopicRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Tema no encontrado"));

        if (!topic.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes");
        }

        topic.setIsUsed(false);
        topic.setIsRejected(false);
        topic.setUsedAt(null);
        BackupTopic saved = backupTopicRepository.save(topic);

        auditLogService.recordAction(user.getTenant(), user.getEmail(), "RESET_TOPIC_USED",
                "Tema restablecido a disponible: " + topic.getTitle());
        return ResponseEntity.ok(saved);
    }

    @PatchMapping("/{id}/toggle-used")
    public ResponseEntity<BackupTopic> toggleTopicUsed(Authentication auth, @PathVariable UUID id) {
        User user = authHelper.getCurrentUser(auth);
        BackupTopic topic = backupTopicRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Tema no encontrado"));

        if (!topic.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes");
        }

        // Si estaba descartado o investigado, regresa a Disponible
        if (Boolean.TRUE.equals(topic.getIsRejected()) || Boolean.TRUE.equals(topic.getIsUsed())) {
            topic.setIsUsed(false);
            topic.setIsRejected(false);
            topic.setUsedAt(null);
        } else {
            // Si estaba disponible, pasa a Investigado
            topic.setIsUsed(true);
            topic.setIsRejected(false);
            topic.setUsedAt(java.time.LocalDateTime.now());
        }

        BackupTopic saved = backupTopicRepository.save(topic);

        String estadoStr = Boolean.TRUE.equals(saved.getIsUsed()) ? "Investigado" : (Boolean.TRUE.equals(saved.getIsRejected()) ? "Descartado" : "Disponible");
        auditLogService.recordAction(user.getTenant(), user.getEmail(), "TOGGLE_TOPIC_USED",
                "Tema cambiado a " + estadoStr + " para: " + topic.getTitle());
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/reorder")
    @Transactional
    public ResponseEntity<Map<String, Object>> reorderTopics(
            Authentication auth,
            @RequestBody List<BulkTopicRequests.ReorderItem> items) {
        User user = authHelper.getCurrentUser(auth);

        for (BulkTopicRequests.ReorderItem item : items) {
            backupTopicRepository.findById(item.id()).ifPresent(topic -> {
                if (topic.getTenant().getId().equals(user.getTenant().getId())) {
                    topic.setPriority(item.priority());
                    backupTopicRepository.save(topic);
                }
            });
        }

        auditLogService.recordAction(user.getTenant(), user.getEmail(), "REORDER_TOPICS", "Reordenadas prioridades de " + items.size() + " temas");
        return ResponseEntity.ok(Map.of("message", "Prioridades de temas actualizadas exitosamente", "count", items.size()));
    }

    @PostMapping("/bulk")
    @Transactional
    public ResponseEntity<Map<String, Object>> addBulkTopics(
            Authentication auth,
            @RequestBody BulkTopicRequests request) {
        User user = authHelper.getCurrentUser(auth);
        List<BackupTopic> toSave = new ArrayList<>();
        boolean defaultAi = Boolean.TRUE.equals(request.isAiResearchDefault());

        if (request.backupTopics() != null && !request.backupTopics().isEmpty()) {
            for (BulkTopicRequests.BackupTopicItem item : request.backupTopics()) {
                if (item.title() != null && !item.title().isBlank()) {
                    boolean isAi = item.isAiResearch() != null ? item.isAiResearch() : defaultAi;
                    toSave.add(BackupTopic.builder()
                            .tenant(user.getTenant())
                            .title(item.title().trim())
                            .description(item.description())
                            .category(item.category() != null && !item.category().isBlank() ? item.category() : (isAi ? "Investigación IA" : "General"))
                            .isAiResearch(isAi)
                            .isActive(true)
                            .priority(item.priority() != null ? item.priority() : 0)
                            .isUsed(false)
                            .build());
                }
            }
        } else if (request.rawBulkText() != null && !request.rawBulkText().isBlank()) {
            String[] lines = request.rawBulkText().split("\\r?\\n");
            for (String line : lines) {
                String clean = line.trim().replaceAll("^[0-9]+[.\\-]\\s*", "").replaceAll("^-\\s*", "");
                if (!clean.isBlank()) {
                    toSave.add(BackupTopic.builder()
                            .tenant(user.getTenant())
                            .title(clean)
                            .category(defaultAi ? "Investigación IA" : "Importado")
                            .isAiResearch(defaultAi)
                            .isActive(true)
                            .priority(0)
                            .isUsed(false)
                            .build());
                }
            }
        }

        List<BackupTopic> saved = backupTopicRepository.saveAll(toSave);
        auditLogService.recordAction(user.getTenant(), user.getEmail(), "BULK_ADD_TOPICS", "Importados " + saved.size() + " temas en bloque");

        return ResponseEntity.ok(Map.of(
                "message", "Se importaron " + saved.size() + " temas exitosamente al Banco Unificado",
                "importedCount", saved.size()
        ));
    }

    @DeleteMapping("/clear-all")
    @Transactional
    public ResponseEntity<Map<String, Object>> clearAllTopics(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        UUID tenantId = user.getTenant().getId();

        List<BackupTopic> topics = backupTopicRepository.findByTenantId(tenantId);
        int count = topics.size();
        backupTopicRepository.deleteAll(topics);

        List<InterestTopic> interests = interestTopicRepository.findByTenantId(tenantId);
        int interestCount = interests.size();
        interestTopicRepository.deleteAll(interests);

        auditLogService.recordAction(user.getTenant(), user.getEmail(),
                "CLEAR_ALL_TOPICS", "Eliminados " + (count + interestCount) + " temas del banco");

        return ResponseEntity.ok(Map.of(
                "message", "Se eliminaron todos los temas del banco",
                "deletedCount", count + interestCount
        ));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTopic(Authentication auth, @PathVariable UUID id) {
        User user = authHelper.getCurrentUser(auth);
        BackupTopic topic = backupTopicRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Tema no encontrado"));

        if (!topic.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes");
        }

        backupTopicRepository.delete(topic);
        auditLogService.recordAction(user.getTenant(), user.getEmail(), "DELETE_TOPIC", "Tema eliminado: " + topic.getTitle());
        return ResponseEntity.noContent().build();
    }

    // =========================================================================
    // ENDPOINTS DE COMPATIBILIDAD RETROACTIVA (BACKUP / INTERESTS)
    // =========================================================================

    @GetMapping("/backup")
    public ResponseEntity<List<BackupTopic>> getBackupTopicsLegacy(Authentication auth) {
        return getUnifiedTopics(auth);
    }

    @PostMapping("/backup")
    public ResponseEntity<BackupTopic> addBackupTopicLegacy(Authentication auth, @Valid @RequestBody BackupTopicRequest request) {
        return addTopic(auth, request);
    }

    @PutMapping("/backup/reorder")
    public ResponseEntity<Map<String, Object>> reorderBackupTopicsLegacy(
            Authentication auth,
            @RequestBody List<BulkTopicRequests.ReorderItem> items) {
        return reorderTopics(auth, items);
    }

    @PostMapping("/backup/bulk")
    public ResponseEntity<Map<String, Object>> addBulkBackupTopicsLegacy(
            Authentication auth,
            @RequestBody BulkTopicRequests request) {
        return addBulkTopics(auth, request);
    }

    @DeleteMapping("/backup/{id}")
    public ResponseEntity<Void> deleteBackupTopicLegacy(Authentication auth, @PathVariable UUID id) {
        return deleteTopic(auth, id);
    }

    @GetMapping("/interests")
    public ResponseEntity<List<InterestTopic>> getInterestTopics(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        return ResponseEntity.ok(interestTopicRepository.findByTenantId(user.getTenant().getId()));
    }

    @PostMapping("/interests")
    public ResponseEntity<InterestTopic> addInterestTopic(Authentication auth, @Valid @RequestBody InterestTopicRequest request) {
        User user = authHelper.getCurrentUser(auth);
        InterestTopic topic = InterestTopic.builder()
                .tenant(user.getTenant())
                .topicName(request.topicName())
                .isActive(true)
                .build();

        InterestTopic saved = interestTopicRepository.save(topic);
        auditLogService.recordAction(user.getTenant(), user.getEmail(), "ADD_KEYWORD", "Palabra clave agregada: " + request.topicName());
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/interests/bulk")
    @Transactional
    public ResponseEntity<Map<String, Object>> addBulkInterestTopics(
            Authentication auth,
            @RequestBody Map<String, Object> body) {
        User user = authHelper.getCurrentUser(auth);
        List<InterestTopic> toSave = new ArrayList<>();

        if (body.containsKey("rawText") && body.get("rawText") != null) {
            String text = body.get("rawText").toString();
            String[] tokens = text.split("[,\\n]+");
            for (String t : tokens) {
                String clean = t.trim().replaceAll("^[0-9]+[.\\-]\\s*", "").replaceAll("^-\\s*", "");
                if (!clean.isBlank()) {
                    toSave.add(InterestTopic.builder()
                            .tenant(user.getTenant())
                            .topicName(clean)
                            .isActive(true)
                            .build());
                }
            }
        }

        List<InterestTopic> saved = interestTopicRepository.saveAll(toSave);
        auditLogService.recordAction(user.getTenant(), user.getEmail(), "BULK_ADD_KEYWORDS", "Importadas " + saved.size() + " palabras clave");

        return ResponseEntity.ok(Map.of(
                "message", "Se importaron " + saved.size() + " palabras clave exitosamente",
                "importedCount", saved.size()
        ));
    }

    @DeleteMapping("/interests/{id}")
    public ResponseEntity<Void> deleteInterestTopic(Authentication auth, @PathVariable UUID id) {
        User user = authHelper.getCurrentUser(auth);
        InterestTopic topic = interestTopicRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Tema no encontrado"));

        if (!topic.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes");
        }

        interestTopicRepository.delete(topic);
        auditLogService.recordAction(user.getTenant(), user.getEmail(), "DELETE_KEYWORD", "Palabra clave eliminada: " + topic.getTopicName());
        return ResponseEntity.noContent().build();
    }
}
