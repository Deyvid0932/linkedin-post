package com.deyvid.backend.service.linkedin;

import com.deyvid.backend.entity.LinkedInCredential;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.exception.PipelineExecutionException;
import com.deyvid.backend.repository.LinkedInCredentialRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class LinkedInPublisherService {

    private final TokenManagementService tokenManagementService;
    private final LinkedInCredentialRepository linkedInCredentialRepository;
    private final WebClient linkedInWebClient;
    private final WebClient genericWebClient;

    public LinkedInPublisherService(
            TokenManagementService tokenManagementService,
            LinkedInCredentialRepository linkedInCredentialRepository,
            @Qualifier("linkedInWebClient") WebClient linkedInWebClient,
            @Qualifier("genericWebClient") WebClient genericWebClient) {
        this.tokenManagementService = tokenManagementService;
        this.linkedInCredentialRepository = linkedInCredentialRepository;
        this.linkedInWebClient = linkedInWebClient;
        this.genericWebClient = genericWebClient;
    }

    /**
     * Publicación legacy: envía el post a la cuenta principal del tenant (o a la primera habilitada).
     */
    public String publishPostWithImage(Tenant tenant, String postText, byte[] imageBytes) {
        LinkedInCredential primary = linkedInCredentialRepository.findByTenantId(tenant.getId())
                .orElseThrow(() -> new PipelineExecutionException("No existen cuentas de LinkedIn configuradas para el tenant " + tenant.getId()));

        return publishSingleAccount(tenant, primary, postText, imageBytes);
    }

    /**
     * Publicación en una cuenta específica con transacción aislada (REQUIRES_NEW).
     * Si la publicación falla en esta cuenta, no afectará a las demás cuentas del tenant.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String publishSingleAccount(Tenant tenant, LinkedInCredential cred, String postText, byte[] imageBytes) {
        if (!tenant.getId().equals(cred.getTenant().getId()) || !Boolean.TRUE.equals(cred.getIsEnabled())) {
            throw new PipelineExecutionException("Cuenta de destino no disponible");
        }
        if (Boolean.TRUE.equals(tenant.getIsEmergencyPaused()) || Boolean.TRUE.equals(tenant.getIsDryRun())) {
            throw new PipelineExecutionException("La cuenta esta pausada o en simulacion");
        }
        String accessToken = tokenManagementService.getValidAccessToken(cred);
        String authorUrn = cred.getEffectiveAuthorUrn();
        String safeText = postText == null ? "" : postText.trim();
        if (safeText.length() > 3000) throw new PipelineExecutionException("El texto supera 3000 caracteres. Edítalo antes de aprobarlo.");
        if (safeText.isBlank()) throw new PipelineExecutionException("El post no contiene texto");
        Map<String, Object> payload = new java.util.HashMap<>(Map.of(
                "author", authorUrn, "commentary", safeText, "visibility", "PUBLIC",
                "distribution", Map.of("feedDistribution", "MAIN_FEED", "targetEntities", List.of(), "thirdPartyDistributionChannels", List.of()),
                "lifecycleState", "PUBLISHED", "isReshareDisabledByAuthor", false));
        if (imageBytes != null && imageBytes.length > 0) {
            try {
                Map<?, ?> init = linkedInWebClient.post().uri("/rest/images?action=initializeUpload")
                        .header("Authorization", "Bearer " + accessToken)
                        .bodyValue(Map.of("initializeUploadRequest", Map.of("owner", authorUrn)))
                        .retrieve().bodyToMono(Map.class).block();
                Map<?, ?> value = (Map<?, ?>) init.get("value");
                java.net.URI upload = java.net.URI.create((String) value.get("uploadUrl"));
                String host = upload.getHost();
                if (!"https".equals(upload.getScheme()) || host == null || upload.getUserInfo() != null
                        || (upload.getPort() != -1 && upload.getPort() != 443)
                        || !(host.equals("linkedin.com") || host.endsWith(".linkedin.com") || host.endsWith(".licdn.com"))) {
                    throw new IllegalArgumentException("Destino de carga no permitido");
                }
                genericWebClient.put().uri(upload).header("Authorization", "Bearer " + accessToken).contentType(MediaType.APPLICATION_OCTET_STREAM).bodyValue(imageBytes)
                        .retrieve().toBodilessEntity().block();
                payload.put("content", Map.of("media", Map.of("title", "Imagen del autor", "id", value.get("image"))));
            } catch (Exception e) {
                throw new PipelineExecutionException("No se pudo adjuntar la imagen. El post se conserva para revision.");
            }
        }
        // Only one post creation request. Never retry a timed-out image post as a text post.
        try {
            var response = linkedInWebClient.post().uri("/rest/posts").header("Authorization", "Bearer " + accessToken)
                    .bodyValue(payload).retrieve().toBodilessEntity().block();
            return extractLinkedInPostUrn(response);
        } catch (Exception e) {
            throw new PipelineExecutionException("No se pudo confirmar el envio a LinkedIn. Revisa la cuenta antes de reintentar.");
        }
    }

    /**
     * Valida en tiempo real un token para un Perfil Personal en la API oficial de LinkedIn.
     * Retorna un mapa con 'authorUrn' y 'displayName' descubiertos.
     */
    public Map<String, String> validateAndDiscoverPersonAccount(String token) {
        try {
            log.info("Validando token de Perfil Personal via /v2/userinfo...");
            @SuppressWarnings("unchecked")
            Map<String, Object> userInfo = genericWebClient.get()
                    .uri("https://api.linkedin.com/v2/userinfo")
                    .header("Authorization", "Bearer " + token)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (userInfo != null && userInfo.containsKey("sub")) {
                String sub = (String) userInfo.get("sub");
                String name = (String) userInfo.getOrDefault("name", "Perfil Personal");
                return Map.of(
                        "authorUrn", "urn:li:person:" + sub,
                        "displayName", name
                );
            }
        } catch (WebClientResponseException e) {
            log.warn("Fallo validando con /v2/userinfo [HTTP {}]: {}. Intentando con /v2/me...", e.getStatusCode(), e.getResponseBodyAsString());
        } catch (Exception e) {
            log.warn("Fallo validando con /v2/userinfo: {}. Intentando con /v2/me...", e.getMessage());
        }

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> meInfo = genericWebClient.get()
                    .uri("https://api.linkedin.com/v2/me")
                    .header("Authorization", "Bearer " + token)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (meInfo != null && meInfo.containsKey("id")) {
                String id = (String) meInfo.get("id");
                String firstName = extractLocalizedName(meInfo, "localizedFirstName", "Nombre");
                String lastName = extractLocalizedName(meInfo, "localizedLastName", "");
                String fullName = (firstName + " " + lastName).trim();

                return Map.of(
                        "authorUrn", "urn:li:person:" + id,
                        "displayName", fullName.isBlank() ? "Perfil Personal" : fullName
                );
            }
        } catch (WebClientResponseException e) {
            String body = e.getResponseBodyAsString();
            log.error("Fallo definitivo validando token de Perfil Personal [HTTP {}]: {}", e.getStatusCode(), body);
            throw new IllegalArgumentException("El token de LinkedIn es inválido o no tiene el scope 'w_member_social' / 'openid' [HTTP " + e.getStatusCode() + "]: " + body);
        } catch (Exception e) {
            String detail = extractWebClientError(e);
            log.error("Fallo definitivo validando token de Perfil Personal: {}", detail);
            throw new IllegalArgumentException("El token de LinkedIn es inválido o no tiene el scope 'w_member_social' / 'openid': " + detail);
        }

        throw new IllegalArgumentException("No se pudo resolver el identificador de usuario desde LinkedIn.");
    }

    /**
     * Valida en tiempo real un token para una Página de Organización en la API oficial de LinkedIn.
     */
    public Map<String, String> validateAndDiscoverOrganizationAccount(String token, String rawUrnOrId, String customDisplayName) {
        String cleanId = rawUrnOrId != null ? rawUrnOrId.replaceAll("[^0-9]", "") : "";
        if (cleanId.isBlank()) {
            throw new IllegalArgumentException("Se requiere el identificador o URN de la Página de Empresa (ej: urn:li:organization:12345678 o 12345678).");
        }

        String targetUrn = "urn:li:organization:" + cleanId;
        String resolvedName = customDisplayName != null && !customDisplayName.isBlank() ? customDisplayName.trim() : "Página de Empresa (" + cleanId + ")";

        // Verificar si el token tiene permisos de administrador sobre la organización
        try {
            log.info("Verificando permisos de administrador en LinkedIn para {}", targetUrn);
            @SuppressWarnings("unchecked")
            Map<String, Object> acls = linkedInWebClient.get()
                    .uri("/rest/organizationalEntityAcls?q=roleAssignee")
                    .header("Authorization", "Bearer " + token)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (acls != null && acls.containsKey("elements")) {
                log.info("Permisos organizacionales verificados exitosamente en LinkedIn.");
            }
        } catch (WebClientResponseException e) {
            log.warn("Verificación de organizationalEntityAcls [HTTP {}]: {}", e.getStatusCode(), e.getResponseBodyAsString());
        } catch (Exception e) {
            log.warn("Verificación de organizationalEntityAcls devolvió advertencia: {}", extractWebClientError(e));
        }

        return Map.of(
                "authorUrn", targetUrn,
                "displayName", resolvedName
        );
    }

    private String extractLocalizedName(Map<String, Object> map, String key, String def) {
        if (map.containsKey(key) && map.get(key) != null) {
            return map.get(key).toString();
        }
        return def;
    }

    private String extractWebClientError(Throwable t) {
        if (t instanceof WebClientResponseException wce) {
            return "HTTP " + wce.getStatusCode() + " - Body: " + wce.getResponseBodyAsString();
        }
        if (t.getCause() instanceof WebClientResponseException wce) {
            return "HTTP " + wce.getStatusCode() + " - Body: " + wce.getResponseBodyAsString();
        }
        return t.getMessage();
    }

    private String extractLinkedInPostUrn(org.springframework.http.ResponseEntity<Void> response) {
        if (response != null && response.getHeaders() != null) {
            String urn = response.getHeaders().getFirst("x-restli-id");
            if (urn == null || urn.isBlank()) {
                urn = response.getHeaders().getFirst("X-RestLi-Id");
            }
            if (urn == null || urn.isBlank()) {
                urn = response.getHeaders().getFirst("x-linkedin-id");
            }
            if (urn != null && !urn.isBlank()) {
                log.info("🎯 URN real de publicación obtenido desde cabeceras HTTP de LinkedIn: {}", urn);
                return urn;
            }
        }
        throw new PipelineExecutionException("LinkedIn no devolvio el identificador del post. Revisa la cuenta antes de reintentar.");
    }

    public String sanitizeAndCapPostText(String rawText) {
        if (rawText == null) return "";
        // Normalizar saltos de línea Windows a Unix
        String text = rawText.replace("\r\n", "\n").replace("\r", "\n");

        // Limpiar sangrías/espacios parásitos al inicio de cada línea manteniendo párrafos
        String[] rawLines = text.split("\n");
        StringBuilder cleaned = new StringBuilder();
        for (int i = 0; i < rawLines.length; i++) {
            cleaned.append(rawLines[i].stripLeading());
            if (i < rawLines.length - 1) {
                cleaned.append("\n");
            }
        }
        text = cleaned.toString().trim();

        // Remover markdown bold (**texto**) que no es renderizado en LinkedIn
        text = text.replace("**", "");

        // Límite oficial de LinkedIn API: 3,000 caracteres en el campo commentary
        if (text.length() <= 2950) {
            return text;
        }

        log.warn("⚠️ Post supera el límite de seguridad de LinkedIn (longitud real: {} chars). Realizando recorte inteligente sin cortar oraciones...", text.length());

        // Separar posibles hashtags al final
        String hashtags = "";
        int lastHashIdx = text.lastIndexOf('#');
        if (lastHashIdx != -1 && lastHashIdx > text.length() - 300) {
            hashtags = text.substring(lastHashIdx).trim();
            text = text.substring(0, lastHashIdx).trim();
        }

        int maxBodyLen = 2900 - (hashtags.isEmpty() ? 0 : (hashtags.length() + 2));
        if (text.length() > maxBodyLen) {
            // Intentar cortar en el último párrafo antes del límite
            int lastParagraphBreak = text.lastIndexOf("\n\n", maxBodyLen);
            if (lastParagraphBreak != -1 && lastParagraphBreak > maxBodyLen - 400) {
                text = text.substring(0, lastParagraphBreak).trim();
            } else {
                // Intentar cortar en el último punto y seguido o salto de línea
                int lastSentenceEnd = Math.max(text.lastIndexOf(". ", maxBodyLen), text.lastIndexOf("\n", maxBodyLen));
                if (lastSentenceEnd != -1 && lastSentenceEnd > maxBodyLen - 300) {
                    text = text.substring(0, lastSentenceEnd + 1).trim();
                } else {
                    text = text.substring(0, maxBodyLen).trim();
                }
            }
        }

        if (!hashtags.isEmpty()) {
            text = text + "\n\n" + hashtags;
        }

        return text.trim();
    }
}
