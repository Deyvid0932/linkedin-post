package com.deyvid.backend.service;

import com.deyvid.backend.entity.PublicationLog;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.entity.enums.LinkedInAccountType;
import com.deyvid.backend.entity.enums.PublicationStatus;
import com.deyvid.backend.entity.enums.SourceMode;
import com.deyvid.backend.repository.PublicationLogRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PublicationLogService {

    private final PublicationLogRepository publicationLogRepository;

    @Transactional
    public PublicationLog createLog(
            Tenant tenant,
            SourceMode sourceMode,
            PublicationStatus status,
            LinkedInAccountType accountType,
            String authorUrn,
            String generatedText,
            String imageUrl,
            String linkedinPostUrn,
            String sourceReference,
            String errorMessage,
            Long executionTimeMs,
            String llmModelUsed,
            Integer llmTokensUsed) {

        String hash = computeTextHash(generatedText);

        PublicationLog log = PublicationLog.builder()
                .tenant(tenant)
                .sourceMode(sourceMode)
                .status(status)
                .accountType(accountType)
                .authorUrn(authorUrn)
                .generatedText(generatedText)
                .imageUrl(imageUrl)
                .linkedinPostUrn(linkedinPostUrn)
                .sourceReference(sourceReference)
                .textHash(hash)
                .errorMessage(errorMessage)
                .executionTimeMs(executionTimeMs)
                .llmModelUsed(llmModelUsed)
                .llmTokensUsed(llmTokensUsed)
                .publishedAt(status == PublicationStatus.SUCCESS ? LocalDateTime.now() : null)
                .build();

        return publicationLogRepository.save(log);
    }

    public static String computeTextHash(String text) {
        if (text == null || text.isBlank()) return "";
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            String normalized = text.replaceAll("\\s+", " ").trim();
            byte[] hashBytes = digest.digest(normalized.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hashBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            return String.valueOf(text.hashCode());
        }
    }

    @Transactional
    public PublicationLog createLog(
            Tenant tenant,
            SourceMode sourceMode,
            PublicationStatus status,
            String generatedText,
            String imageUrl,
            String linkedinPostUrn,
            String sourceReference,
            String errorMessage,
            Long executionTimeMs,
            String llmModelUsed,
            Integer llmTokensUsed) {
        return createLog(
                tenant, sourceMode, status, null, null,
                generatedText, imageUrl, linkedinPostUrn, sourceReference,
                errorMessage, executionTimeMs, llmModelUsed, llmTokensUsed
        );
    }

    @Transactional(readOnly = true)
    public Page<PublicationLog> getLogsByTenant(
            UUID tenantId,
            PublicationStatus status,
            SourceMode sourceMode,
            LocalDate startDate,
            LocalDate endDate,
            String search,
            Pageable pageable) {

        Specification<PublicationLog> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("tenant").get("id"), tenantId));

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (sourceMode != null) {
                predicates.add(cb.equal(root.get("sourceMode"), sourceMode));
            }
            if (startDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), startDate.atStartOfDay()));
            }
            if (endDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), endDate.atTime(LocalTime.MAX)));
            }
            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                Predicate textLike = cb.like(cb.lower(root.get("generatedText")), pattern);
                Predicate refLike = cb.like(cb.lower(root.get("sourceReference")), pattern);
                predicates.add(cb.or(textLike, refLike));
            }

            query.orderBy(cb.desc(root.get("createdAt")));
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return publicationLogRepository.findAll(spec, pageable);
    }
}
