package com.deyvid.backend.service.webhook;

import com.deyvid.backend.dto.request.CreateWebhookEndpointRequest;
import com.deyvid.backend.dto.response.WebhookCreatedResponse;
import com.deyvid.backend.dto.response.WebhookDeliveryResponse;
import com.deyvid.backend.dto.response.WebhookEndpointResponse;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.entity.TenantWebhookEndpoint;
import com.deyvid.backend.entity.WebhookDelivery;
import com.deyvid.backend.repository.TenantWebhookEndpointRepository;
import com.deyvid.backend.repository.WebhookDeliveryRepository;
import com.deyvid.backend.service.AuditLogService;
import com.deyvid.backend.service.EncryptionService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.hc.client5.http.DnsResolver;
import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.CloseableHttpResponse;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.apache.hc.core5.util.Timeout;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.net.SocketTimeoutException;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@Service
@RequiredArgsConstructor
@Slf4j
public class WebhookDeliveryService {
    private static final Set<String> ALLOWED_EVENTS = Set.of("post.published", "post.delivery_unknown");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final TenantWebhookEndpointRepository endpoints;
    private final WebhookDeliveryRepository deliveries;
    private final EncryptionService encryptionService;
    private final SafeWebhookUrlService safeUrlService;
    private final JsonMapper objectMapper = JsonMapper.builder().build();
    private final AuditLogService auditLogService;

    @Transactional
    public List<WebhookEndpointResponse> list(UUID tenantId) {
        return endpoints.findByTenantIdOrderByCreatedAtDesc(tenantId).stream().map(this::toEndpointResponse).toList();
    }

    @Transactional
    public WebhookCreatedResponse create(Tenant tenant, String actorEmail, CreateWebhookEndpointRequest request) {
        URI target = safeUrlService.validateSyntax(request.targetUrl());
        List<String> events = normalizeEvents(request.events());
        String secret = generateSecret();
        TenantWebhookEndpoint endpoint = TenantWebhookEndpoint.builder()
                .tenant(tenant)
                .name(request.name().trim())
                .targetHost(target.getHost())
                .encryptedTargetUrl(encryptionService.encrypt(target.toString()))
                .encryptedSecret(encryptionService.encrypt(secret))
                .subscribedEvents(String.join(",", events))
                .active(true)
                .build();
        TenantWebhookEndpoint saved = endpoints.save(endpoint);
        record(tenant, actorEmail, "WEBHOOK_ENDPOINT_CREATED", saved.getId().toString());
        return new WebhookCreatedResponse(toEndpointResponse(saved), secret);
    }

    @Transactional
    public WebhookEndpointResponse setActive(UUID tenantId, String actorEmail, UUID endpointId, boolean active) {
        TenantWebhookEndpoint endpoint = requireEndpoint(tenantId, endpointId);
        endpoint.setActive(active);
        TenantWebhookEndpoint saved = endpoints.save(endpoint);
        record(saved.getTenant(), actorEmail, active ? "WEBHOOK_ENDPOINT_ENABLED" : "WEBHOOK_ENDPOINT_DISABLED", endpointId.toString());
        return toEndpointResponse(saved);
    }

    @Transactional
    public void delete(UUID tenantId, String actorEmail, UUID endpointId) {
        TenantWebhookEndpoint endpoint = requireEndpoint(tenantId, endpointId);
        endpoints.delete(endpoint);
        record(endpoint.getTenant(), actorEmail, "WEBHOOK_ENDPOINT_DELETED", endpointId.toString());
    }

    @Transactional
    public WebhookDeliveryResponse sendTest(Tenant tenant, UUID endpointId) {
        TenantWebhookEndpoint endpoint = requireEndpoint(tenant.getId(), endpointId);
        return deliver(endpoint, UUID.randomUUID(), "webhook.test", Map.of("message", "Conexión de prueba de AutoPost"), null);
    }

    @Async
    @Transactional
    public void dispatchPublished(UUID tenantId, UUID eventId, Map<String, Object> data) {
        dispatch(tenantId, eventId, "post.published", data);
    }

    @Async
    @Transactional
    public void dispatchUnknown(UUID tenantId, UUID eventId, Map<String, Object> data) {
        dispatch(tenantId, eventId, "post.delivery_unknown", data);
    }

    @Transactional
    public Page<WebhookDeliveryResponse> listDeliveries(UUID tenantId, int page, int size) {
        if (page < 0) throw new IllegalArgumentException("La página debe ser cero o mayor");
        int safeSize = Math.max(1, Math.min(size, 50));
        return deliveries.findByTenantIdOrderByCreatedAtDesc(tenantId, PageRequest.of(page, safeSize)).map(this::toDeliveryResponse);
    }

    @Transactional
    public WebhookDeliveryResponse retry(UUID tenantId, UUID deliveryId) {
        WebhookDelivery delivery = deliveries.findByIdAndTenantId(deliveryId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("El envío no existe"));
        if ("DELIVERED".equals(delivery.getStatus())) throw new IllegalArgumentException("El webhook ya fue entregado");
        return deliver(delivery.getEndpoint(), delivery.getEventId(), delivery.getEventType(), parsePayload(delivery.getPayloadJson()), delivery);
    }

    private void dispatch(UUID tenantId, UUID eventId, String eventType, Map<String, Object> data) {
        if (!ALLOWED_EVENTS.contains(eventType)) return;
        for (TenantWebhookEndpoint endpoint : endpoints.findByTenantIdAndActiveTrue(tenantId)) {
            if (Arrays.asList(endpoint.getSubscribedEvents().split(",")).contains(eventType)) {
                deliver(endpoint, eventId, eventType, data, null);
            }
        }
    }

    private WebhookDeliveryResponse deliver(TenantWebhookEndpoint endpoint, UUID eventId, String eventType,
                                             Map<String, Object> data, WebhookDelivery existing) {
        WebhookDelivery delivery = existing != null ? existing : WebhookDelivery.builder()
                .tenant(endpoint.getTenant())
                .endpoint(endpoint)
                .eventId(eventId)
                .eventType(eventType)
                .payloadJson(serializePayload(eventId, eventType, data))
                .status("PENDING")
                .attemptCount(0)
                .build();
        delivery.setAttemptCount(delivery.getAttemptCount() + 1);
        delivery.setStatus("SENDING");
        delivery.setResponseSummary(null);
        delivery.setHttpStatus(null);
        deliveries.saveAndFlush(delivery);

        try {
            SafeWebhookUrlService.ValidatedDestination target = safeUrlService.resolvePublicDestination(
                    encryptionService.decrypt(endpoint.getEncryptedTargetUrl()));
            String payload = delivery.getPayloadJson();
            String secret = encryptionService.decrypt(endpoint.getEncryptedSecret());
            HttpPost request = new HttpPost(target.uri());
            request.setHeader("Accept", "application/json");
            request.setHeader("X-AutoPost-Event", eventType);
            request.setHeader("X-AutoPost-Delivery", eventId.toString());
            request.setHeader("X-AutoPost-Signature", "sha256=" + sign(payload, secret));
            request.setEntity(new StringEntity(payload, ContentType.APPLICATION_JSON.withCharset(StandardCharsets.UTF_8)));

            RequestConfig requestConfig = RequestConfig.custom()
                    .setConnectTimeout(Timeout.ofSeconds(4))
                    .setConnectionRequestTimeout(Timeout.ofSeconds(4))
                    .setResponseTimeout(Timeout.ofSeconds(8))
                    .setRedirectsEnabled(false)
                    .build();
            var connectionManager = PoolingHttpClientConnectionManagerBuilder.create()
                    .setDnsResolver(pinnedDnsResolver(target))
                    .setMaxConnTotal(1)
                    .setMaxConnPerRoute(1)
                    .build();
            try (CloseableHttpClient client = HttpClients.custom()
                    .setConnectionManager(connectionManager)
                    .setDefaultRequestConfig(requestConfig)
                    .disableRedirectHandling()
                    .disableAutomaticRetries()
                    .build();
                 CloseableHttpResponse response = client.execute(request)) {
                String summary = "";
                if (response.getEntity() != null) {
                    try (InputStream body = response.getEntity().getContent()) {
                        summary = readResponseSummary(body);
                    }
                }
                delivery.setHttpStatus(response.getCode());
                delivery.setResponseSummary(summary);
                if (response.getCode() >= 200 && response.getCode() < 300) {
                    delivery.setStatus("DELIVERED");
                    delivery.setDeliveredAt(LocalDateTime.now());
                    endpoint.setUpdatedAt(LocalDateTime.now());
                    endpoints.save(endpoint);
                } else {
                    delivery.setStatus("FAILED");
                    if (summary.isBlank()) delivery.setResponseSummary("El servidor respondió HTTP " + response.getCode());
                }
            }
        } catch (Exception e) {
            if (e instanceof InterruptedException || e instanceof java.io.InterruptedIOException) {
                Thread.currentThread().interrupt();
            }
            delivery.setStatus("FAILED");
            delivery.setResponseSummary(e instanceof IllegalArgumentException ? sanitizeSummary(e.getMessage()) : e.getClass().getSimpleName());
            log.warn("Webhook {} no entregado ({})", endpoint.getId(), e.getClass().getSimpleName());
        }
        return toDeliveryResponse(deliveries.save(delivery));
    }

    private String readResponseSummary(InputStream body) throws java.io.IOException {
        byte[] bytes = new byte[1024];
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(8);
        int total = 0;
        while (total < bytes.length) {
            if (System.nanoTime() >= deadline) throw new SocketTimeoutException("Tiempo de respuesta del webhook agotado");
            int read = body.read(bytes, total, Math.min(256, bytes.length - total));
            if (read < 0) break;
            if (read == 0) continue;
            total += read;
        }
        return sanitizeSummary(new String(bytes, 0, total, StandardCharsets.UTF_8));
    }

    static DnsResolver pinnedDnsResolver(SafeWebhookUrlService.ValidatedDestination target) {
        String expectedHost = target.uri().getHost().toLowerCase(Locale.ROOT);
        InetAddress[] pinnedAddresses = target.addresses().toArray(InetAddress[]::new);
        return new DnsResolver() {
            private void requireExpectedHost(String host) throws UnknownHostException {
                if (host == null || !expectedHost.equalsIgnoreCase(host)) {
                    throw new UnknownHostException("El cliente intentó resolver un host distinto al validado");
                }
            }

            @Override
            public InetAddress[] resolve(String host) throws UnknownHostException {
                requireExpectedHost(host);
                return pinnedAddresses.clone();
            }

            @Override
            public String resolveCanonicalHostname(String host) throws UnknownHostException {
                requireExpectedHost(host);
                return expectedHost;
            }
        };
    }

    private String serializePayload(UUID eventId, String eventType, Map<String, Object> data) {
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("eventId", eventId.toString());
            body.put("event", eventType);
            body.put("occurredAt", LocalDateTime.now().toString());
            body.put("data", data == null ? Map.of() : data);
            return objectMapper.writeValueAsString(body);
        } catch (Exception e) {
            throw new IllegalArgumentException("No se pudo construir el evento webhook");
        }
    }

    private Map<String, Object> parsePayload(String payload) {
        try { return objectMapper.readValue(payload, new TypeReference<>() {}); }
        catch (Exception e) { throw new IllegalArgumentException("El payload del evento no se puede recuperar"); }
    }

    private String sign(String payload, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
    }

    private String generateSecret() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String sanitizeSummary(String text) {
        if (text == null) return "";
        String safe = text.replaceAll("[\\p{Cntrl}&&[^\\r\\n\\t]]", " ").trim();
        return safe.substring(0, Math.min(500, safe.length()));
    }

    private List<String> normalizeEvents(List<String> requested) {
        if (requested == null || requested.isEmpty()) throw new IllegalArgumentException("Selecciona al menos un evento");
        LinkedHashSet<String> events = requested.stream().map(String::trim).collect(Collectors.toCollection(LinkedHashSet::new));
        if (events.size() != requested.size() || !ALLOWED_EVENTS.containsAll(events)) {
            throw new IllegalArgumentException("La suscripción incluye eventos no disponibles");
        }
        return List.copyOf(events);
    }

    private TenantWebhookEndpoint requireEndpoint(UUID tenantId, UUID endpointId) {
        return endpoints.findByIdAndTenantId(endpointId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("El webhook no existe"));
    }

    private WebhookEndpointResponse toEndpointResponse(TenantWebhookEndpoint endpoint) {
        return new WebhookEndpointResponse(endpoint.getId(), endpoint.getName(), endpoint.getTargetHost(),
                List.of(endpoint.getSubscribedEvents().split(",")), Boolean.TRUE.equals(endpoint.getActive()), true, endpoint.getCreatedAt());
    }

    private WebhookDeliveryResponse toDeliveryResponse(WebhookDelivery delivery) {
        return new WebhookDeliveryResponse(delivery.getId(), delivery.getEndpoint().getId(), delivery.getEndpoint().getName(),
                delivery.getEventId(), delivery.getEventType(), delivery.getStatus(), delivery.getAttemptCount(),
                delivery.getHttpStatus(), delivery.getResponseSummary(), delivery.getCreatedAt(), delivery.getDeliveredAt());
    }

    private void record(Tenant tenant, String actorEmail, String action, String details) {
        if (auditLogService != null) auditLogService.recordAction(tenant, actorEmail, action, details);
    }
}
