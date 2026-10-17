package com.deyvid.backend.service.ai;

import com.deyvid.backend.entity.FeedbackIa;
import com.deyvid.backend.entity.Tenant;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class VectorStoreService {

    private final VectorStore vectorStore;

    public VectorStoreService(@org.springframework.lang.Nullable VectorStore vectorStore) {
        this.vectorStore = vectorStore;
    }

    public void saveFeedbackDocument(FeedbackIa feedback) {
        if (vectorStore == null) {
            log.warn("VectorStore no está activo en este entorno. Se omite el guardado de embedding.");
            return;
        }

        try {
            Document doc = new Document(
                    feedback.getTextoGenerado(),
                    Map.of(
                            "tenantId", feedback.getTenant().getId().toString(),
                            "puntajeUsuario", feedback.getPuntajeUsuario(),
                            "estructuraUsada", feedback.getEstructuraUsada() != null ? feedback.getEstructuraUsada() : "DEFAULT",
                            "sourceMode", feedback.getSourceMode() != null ? feedback.getSourceMode().name() : "PROJECT"
                    )
            );

            vectorStore.add(List.of(doc));
            log.info("Documento de feedback (Puntaje: {}) guardado exitosamente en VectorStore (pgvector)", feedback.getPuntajeUsuario());
        } catch (Exception e) {
            log.error("Error al guardar embedding en VectorStore: {}", e.getMessage());
        }
    }

    public List<String> findTopLikedContexts(Tenant tenant, String topicQuery) {
        if (vectorStore == null || tenant == null || tenant.getId() == null) {
            return List.of();
        }

        try {
            SearchRequest request = SearchRequest.builder()
                    .query(topicQuery)
                    .topK(3)
                    .similarityThreshold(0.6)
                    .filterExpression("tenantId == '" + tenant.getId() + "' && puntajeUsuario > 0")
                    .build();

            List<Document> results = vectorStore.similaritySearch(request);
            return results.stream()
                    .filter(doc -> {
                        if (!tenant.getId().toString().equals(doc.getMetadata().get("tenantId"))) return false;
                        Object scoreObj = doc.getMetadata().get("puntajeUsuario");
                        return scoreObj != null && Integer.parseInt(scoreObj.toString()) > 0;
                    })
                    .map(Document::getText)
                    .toList();
        } catch (Exception e) {
            log.warn("No se pudieron recuperar ejemplos de VectorStore: {}", e.getMessage());
            return List.of();
        }
    }
}
