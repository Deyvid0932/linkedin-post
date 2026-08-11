package com.deyvid.backend.job;

import com.deyvid.backend.entity.LinkedInCredential;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.repository.LinkedInCredentialRepository;
import com.deyvid.backend.repository.UserRepository;
import com.deyvid.backend.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class TokenExpirationCheckerJob {

    private final LinkedInCredentialRepository linkedInCredentialRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;

    @Scheduled(cron = "0 0 8 * * *") // Todos los días a las 8:00 AM
    @Transactional
    public void checkTokenExpirations() {
        log.info("Iniciando verificación proactiva de expiración de tokens LinkedIn...");
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime threshold = now.plusDays(15); // Tokens que expiran dentro de 15 días

        List<LinkedInCredential> credentials = linkedInCredentialRepository.findByIsValidTrueAndTokenExpiresAtBefore(threshold);

        for (LinkedInCredential cred : credentials) {
            long daysRemaining = Duration.between(now, cred.getTokenExpiresAt()).toDays();
            
            // Verificar si aplica la regla de 14, 7 o 2 días
            if (daysRemaining <= 14 && daysRemaining >= 0) {
                LocalDateTime lastAlert = cred.getLastExpirationAlertSent();
                
                // Evitar spam: solo enviar si no se ha enviado una alerta en las últimas 20 horas
                if (lastAlert == null || Duration.between(lastAlert, now).toHours() >= 20) {
                    List<User> users = userRepository.findAll().stream()
                            .filter(u -> u.getTenant().getId().equals(cred.getTenant().getId()))
                            .toList();

                    for (User user : users) {
                        emailService.sendTokenExpirationAlert(user.getEmail(), user.getName(), Math.max(daysRemaining, 1));
                    }

                    cred.setLastExpirationAlertSent(now);
                    linkedInCredentialRepository.save(cred);
                    log.info("Alerta de expiración registrada para tenant {}", cred.getTenant().getId());
                }
            }
        }
    }
}
