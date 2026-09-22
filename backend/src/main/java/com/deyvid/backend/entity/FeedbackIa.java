package com.deyvid.backend.entity;

import com.deyvid.backend.entity.enums.SourceMode;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "feedback_ia")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FeedbackIa {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(name = "texto_generado", nullable = false, columnDefinition = "TEXT")
    private String textoGenerado;

    @Column(name = "tema")
    private String tema;

    @Column(name = "puntaje_usuario", nullable = false)
    private Integer puntajeUsuario; // 1 = Like, -1 = Dislike, 0 = Neutral/Borrador

    @Column(name = "estructura_usada")
    private String estructuraUsada; // EXPERT, STORYTELLER, PROVOCATIVE

    @Enumerated(EnumType.STRING)
    @Column(name = "source_mode")
    private SourceMode sourceMode;

    @Column(name = "llm_tokens_used")
    private Integer llmTokensUsed;

    @Column(name = "cost_usd", precision = 10, scale = 6)
    private BigDecimal costUsd;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
