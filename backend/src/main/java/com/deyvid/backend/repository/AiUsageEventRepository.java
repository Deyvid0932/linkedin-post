package com.deyvid.backend.repository;

import com.deyvid.backend.entity.AiUsageEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface AiUsageEventRepository extends JpaRepository<AiUsageEvent, UUID> {
    @Query("""
            select min(e.createdAt)
            from AiUsageEvent e
            where e.purpose = 'TEXT_GENERATION'
              and e.totalTokens is not null
            """)
    LocalDateTime firstReportedTextUsageAt();

    @Query("""
            select min(e.createdAt)
            from AiUsageEvent e
            where e.purpose = 'IMAGE_GENERATION'
            """)
    LocalDateTime firstImageGenerationAt();

    @Query(value = """
            select to_char(((created_at at time zone 'UTC') at time zone 'America/Lima')::date, 'YYYY-MM-DD'),
                   count(id)
            from ai_usage_events
            where purpose = 'IMAGE_GENERATION'
              and created_at >= ((cast(:from as timestamp) at time zone 'America/Lima') at time zone 'UTC')
            group by 1
            order by 1
            """, nativeQuery = true)
    List<Object[]> summarizeImageGenerationsByDaySince(@Param("from") LocalDateTime from);

    @Query("""
            select count(e.id)
            from AiUsageEvent e
            where e.purpose = 'TEXT_GENERATION'
              and e.totalTokens is not null
              and e.createdAt >= :from
            """)
    long countReportedTextRequestsSince(@Param("from") LocalDateTime from);

    @Query(value = """
            select to_char(((created_at at time zone 'UTC') at time zone 'America/Lima')::date, 'YYYY-MM-DD'),
                   coalesce(sum(total_tokens), 0)
            from ai_usage_events
            where purpose = 'TEXT_GENERATION'
              and total_tokens is not null
              and created_at >= ((cast(:from as timestamp) at time zone 'America/Lima') at time zone 'UTC')
            group by 1
            order by 1
            """, nativeQuery = true)
    List<Object[]> summarizeReportedTextTokensByDaySince(@Param("from") LocalDateTime from);

    @Query("""
            select e.provider, e.model, count(e.id),
                   coalesce(sum(e.inputTokens), 0),
                   coalesce(sum(e.outputTokens), 0),
                   coalesce(sum(e.totalTokens), 0)
            from AiUsageEvent e
            where e.purpose = 'TEXT_GENERATION'
              and e.totalTokens is not null
              and e.createdAt >= :from
            group by e.provider, e.model
            order by coalesce(sum(e.totalTokens), 0) desc
            """)
    List<Object[]> summarizeTextUsageByProviderAndModelSince(
            @Param("from") LocalDateTime from,
            Pageable pageable);

    @Query("""
            select coalesce(e.model, 'Modelo no informado'),
                   coalesce(sum(e.totalTokens), 0),
                   coalesce(sum(e.inputTokens), 0),
                   coalesce(sum(e.outputTokens), 0),
                   count(e.id)
            from AiUsageEvent e
            where e.tenant.id = :tenantId
              and e.purpose = 'TEXT_GENERATION'
              and e.totalTokens is not null
              and e.createdAt >= coalesce(:from, e.createdAt)
            group by e.model
            """)
    List<Object[]> summarizeTextUsageByModel(
            @Param("tenantId") UUID tenantId,
            @Param("from") LocalDateTime from);

    @Query(value = """
            select to_char(((created_at at time zone 'UTC') at time zone :timezone)::date, 'YYYY-MM-DD'),
                   coalesce(sum(total_tokens), 0)
            from ai_usage_events
            where tenant_id = :tenantId
              and purpose = 'TEXT_GENERATION'
              and total_tokens is not null
              and created_at >= coalesce(cast(:from as timestamp), created_at)
            group by 1
            order by 1
            """, nativeQuery = true)
    List<Object[]> summarizeTextUsageByDay(
            @Param("tenantId") UUID tenantId,
            @Param("from") LocalDateTime from,
            @Param("timezone") String timezone);
}
