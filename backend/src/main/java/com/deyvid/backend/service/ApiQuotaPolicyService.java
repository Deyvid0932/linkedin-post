package com.deyvid.backend.service;

import com.deyvid.backend.dto.request.ApiQuotaPolicyRequest;
import com.deyvid.backend.dto.response.ApiQuotaPolicyResponse;
import com.deyvid.backend.entity.PlatformApiQuotaSettings;
import com.deyvid.backend.repository.PlatformApiQuotaSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class ApiQuotaPolicyService implements ApplicationRunner {
    private static final short SETTINGS_ID = 1;
    private volatile RatePolicy current = new RatePolicy(20, 10, 120);
    private final PlatformApiQuotaSettingsRepository repository;

    @Override
    @Transactional(readOnly = true)
    public void run(ApplicationArguments args) {
        repository.findById(SETTINGS_ID).ifPresent(this::publish);
    }

    @Transactional(readOnly = true)
    public ApiQuotaPolicyResponse getPolicy() {
        PlatformApiQuotaSettings settings = repository.findById(SETTINGS_ID)
                .orElseThrow(() -> new IllegalStateException("No está configurada la política de cuotas API"));
        return response(settings);
    }

    @Transactional
    public ApiQuotaPolicyResponse updatePolicy(ApiQuotaPolicyRequest request) {
        validate(request);
        PlatformApiQuotaSettings settings = repository.findById(SETTINGS_ID)
                .orElseThrow(() -> new IllegalStateException("No está configurada la política de cuotas API"));
        settings.setAuthRequestsPerMinute(request.authRequestsPerMinute());
        settings.setAiRequestsPerMinute(request.aiRequestsPerMinute());
        settings.setApiRequestsPerMinute(request.apiRequestsPerMinute());
        settings.setUpdatedAt(LocalDateTime.now());
        PlatformApiQuotaSettings saved = repository.save(settings);
        Runnable publishSettings = () -> publish(saved);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { publishSettings.run(); }
            });
        } else {
            publishSettings.run();
        }
        return response(saved);
    }

    public RatePolicy currentPolicy() {
        if (repository == null) return current;
        RatePolicy latest = repository.findById(SETTINGS_ID)
                .map(settings -> new RatePolicy(settings.getAuthRequestsPerMinute(),
                        settings.getAiRequestsPerMinute(), settings.getApiRequestsPerMinute()))
                .orElse(current);
        current = latest;
        return latest;
    }

    public void validate(ApiQuotaPolicyRequest request) {
        if (request == null || request.authRequestsPerMinute() == null
                || request.authRequestsPerMinute() < 1 || request.authRequestsPerMinute() > 120
                || request.aiRequestsPerMinute() == null || request.aiRequestsPerMinute() < 1 || request.aiRequestsPerMinute() > 120
                || request.apiRequestsPerMinute() == null || request.apiRequestsPerMinute() < 1 || request.apiRequestsPerMinute() > 600) {
            throw new IllegalArgumentException("Los límites deben estar dentro de los rangos permitidos");
        }
    }

    private void publish(PlatformApiQuotaSettings settings) {
        current = new RatePolicy(settings.getAuthRequestsPerMinute(), settings.getAiRequestsPerMinute(), settings.getApiRequestsPerMinute());
    }

    private ApiQuotaPolicyResponse response(PlatformApiQuotaSettings settings) {
        return new ApiQuotaPolicyResponse(settings.getAuthRequestsPerMinute(), settings.getAiRequestsPerMinute(),
                settings.getApiRequestsPerMinute(), settings.getUpdatedAt());
    }

    public record RatePolicy(int authRequestsPerMinute, int aiRequestsPerMinute, int apiRequestsPerMinute) {
        public int limitFor(String group) {
            return switch (group) {
                case "auth" -> authRequestsPerMinute;
                case "ai" -> aiRequestsPerMinute;
                default -> apiRequestsPerMinute;
            };
        }
    }
}
