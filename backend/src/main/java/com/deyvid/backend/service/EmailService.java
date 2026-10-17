package com.deyvid.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

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
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(toEmail);
            message.setSubject("⚠️ Alerta: Tu token de LinkedIn vencerá en " + daysRemaining + " días");
            message.setText("Hola " + userName + ",\n\n"
                    + "Tu token de acceso a la API de LinkedIn vencerá en " + daysRemaining + " días.\n"
                    + "Para mantener activas tus publicaciones automáticas, por favor ingresa a la plataforma y reconecta tu cuenta.\n\n"
                    + "Saludos,\nEquipo LinkedIn Content Engine");

            mailSender.send(message);
            log.info("📧 Correo de alerta de expiración enviado a: {}", toEmail);
        } catch (Exception e) {
            log.error("Fallo al enviar correo de alerta a {}: {}", toEmail, e.getMessage());
        }
    }

    @Async
    public void sendPasswordResetOtp(String toEmail, String userName, String otpCode) {

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(toEmail);
            message.setSubject("🔐 Código de Seguridad: " + otpCode);
            message.setText("Hola " + (userName != null ? userName : "Usuario") + ",\n\n"
                    + "Tu código de seguridad para restablecer tu contraseña es:\n\n"
                    + "   >>>  " + otpCode + "  <<<\n\n"
                    + "Este código es de un solo uso y vencerá en 15 minutos.\n"
                    + "Si no solicitaste este cambio, puedes ignorar este correo.\n\n"
                    + "Atentamente,\nEquipo de Seguridad");

            mailSender.send(message);
            log.info("✅ Correo con código OTP enviado exitosamente a: {}", toEmail);
        } catch (Exception e) {
            log.warn("No se pudo enviar el correo de recuperación. Revisa la configuración SMTP.");
        }
    }
}
