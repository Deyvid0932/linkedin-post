package com.deyvid.backend.service.source;

import com.deyvid.backend.entity.InterestTopic;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.entity.enums.SourceMode;
import com.deyvid.backend.service.linkedin.ContentSource;
import com.deyvid.backend.repository.InterestTopicRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class ResearchSourceService {

    private final InterestTopicRepository interestTopicRepository;

    public Optional<ContentSource> findTrendingTopic(Tenant tenant) {
        log.info("Evaluando Prioridad 2 (MODO INVESTIGACIÓN) para tenant {}", tenant.getId());

        List<InterestTopic> topics = interestTopicRepository.findByTenantIdAndIsActiveTrue(tenant.getId());
        if (topics.isEmpty()) {
            log.info("No hay temas de interés configurados para el tenant {}", tenant.getId());
            return Optional.empty();
        }

        // Seleccionar un tema de interés aleatorio o rotativo
        InterestTopic topic = topics.get((int) (Math.random() * topics.size()));
        String topicName = topic.getTopicName();

        log.info("Tema seleccionado para investigación: {}", topicName);

        // Retorna el tema para que el ContentGeneratorService realice el análisis técnico
        return Optional.of(new ContentSource(
                SourceMode.RESEARCH,
                "Tendencias e Innovación en " + topicName,
                "Análisis de las mejores prácticas y novedades recientes sobre " + topicName + " en arquitecturas de software modernas.",
                null,
                "https://spring.io/blog"
        ));
    }
}
