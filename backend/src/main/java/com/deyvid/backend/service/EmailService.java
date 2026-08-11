package com.deyvid.backend.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.email.from:noreply@saas-linkedin.com}")
    private String fromEmail;

    @Async
    public void sendTokenExpirationAlert(String toEmail, String userName, long daysRemaining) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED, StandardCharsets.UTF_8.name());

            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject("⚠️ Tu token de LinkedIn vencerá en " + daysRemaining + " días");

            String htmlContent = """
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; }
                        .card { background: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); max-width: 600px; margin: auto; }
                        .header { color: #0a66c2; font-size: 24px; font-weight: bold; margin-bottom: 15px; }
                        .btn { display: inline-block; background-color: #0a66c2; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
                        .footer { margin-top: 30px; font-size: 12px; color: #888888; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="header">LinkedIn Content Engine</div>
                        <p>Hola <strong>%s</strong>,</p>
                        <p>Tu token de acceso a la API de LinkedIn vence en <strong>%d días</strong>.</p>
                        <p>Para asegurar que tus publicaciones automáticas no se interrumpan, haz clic en el siguiente botón para reconectar tu cuenta de LinkedIn:</p>
                        <a href="http://localhost:4200/settings/linkedin" class="btn">Reconectar LinkedIn Ahora</a>
                        <p class="footer">Este es un correo automático generado por tu plataforma SaaS de automatización LinkedIn.</p>
                    </div>
                </body>
                </html>
                """.formatted(userName, daysRemaining);

            helper.setText(htmlContent, true);
            mailSender.send(message);
            log.info("Correo de alerta de expiración de token enviado a {}", toEmail);
        } catch (MessagingException e) {
            log.error("Error al enviar correo de alerta a {}: {}", toEmail, e.getMessage());
        }
    }
}
