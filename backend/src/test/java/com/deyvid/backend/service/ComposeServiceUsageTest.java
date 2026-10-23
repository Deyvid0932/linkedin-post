package com.deyvid.backend.service;

import com.deyvid.backend.dto.request.ComposeRequest;
import com.deyvid.backend.entity.AiUsageEvent;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.repository.AiUsageEventRepository;
import com.deyvid.backend.service.ai.AiUsageEventService;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

class ComposeServiceUsageTest {
    @Test
    void recordsOnlyUsageReportedByTheTextProvider() throws Exception {
        AtomicReference<AiUsageEvent> saved = new AtomicReference<>();
        ComposeService service = service(response(true), saved);
        Tenant tenant = Tenant.builder().id(UUID.randomUUID()).appTargetCharacters(500).build();

        ComposeService.Proposal proposal = service.generate(tenant, request());

        assertEquals("Una propuesta técnica breve.", proposal.text());
        assertNotNull(saved.get());
        assertEquals("deepseek-flash", saved.get().getModel());
        assertEquals(47, saved.get().getInputTokens());
        assertEquals(16, saved.get().getOutputTokens());
        assertEquals(63, saved.get().getTotalTokens());
        assertNull(saved.get().getCostUsd());
    }

    @Test
    void stillReturnsTheDraftWhenTheProviderDoesNotReportUsage() throws Exception {
        AtomicReference<AiUsageEvent> saved = new AtomicReference<>();
        ComposeService service = service(response(false), saved);

        assertEquals("Una propuesta técnica breve.", service.generate(
                Tenant.builder().id(UUID.randomUUID()).appTargetCharacters(500).build(), request()).text());
        assertNull(saved.get());
    }

    private ComposeService service(Map<String, Object> response, AtomicReference<AiUsageEvent> saved) throws Exception {
        AiUsageEventRepository repository = (AiUsageEventRepository) Proxy.newProxyInstance(
                AiUsageEventRepository.class.getClassLoader(), new Class<?>[]{AiUsageEventRepository.class},
                (proxy, method, args) -> {
                    if (method.getName().equals("save")) {
                        AiUsageEvent event = (AiUsageEvent) args[0];
                        saved.set(event);
                        return event;
                    }
                    if (method.getDeclaringClass() == Object.class) return objectMethod(proxy, method.getName(), args);
                    throw new UnsupportedOperationException(method.getName());
                });
        ComposeService service = new ComposeService(new SafeImageService(), webClient(response), null, null,
                new AiUsageEventService(repository));
        set(service, "textApiKey", "test-key");
        set(service, "textBaseUrl", "https://api.deepseek.com");
        set(service, "textModel", "deepseek-flash");
        return service;
    }

    private WebClient webClient(Map<String, Object> response) {
        WebClient client = (WebClient) Proxy.newProxyInstance(
                WebClient.class.getClassLoader(), new Class<?>[]{WebClient.class},
                (proxy, method, args) -> {
                    if (method.getName().equals("post")) return requestSpec(response);
                    if (method.getDeclaringClass() == Object.class) return objectMethod(proxy, method.getName(), args);
                    throw new UnsupportedOperationException(method.getName());
                });
        return client;
    }

    private WebClient.RequestBodyUriSpec requestSpec(Map<String, Object> response) {
        return (WebClient.RequestBodyUriSpec) Proxy.newProxyInstance(
                WebClient.RequestBodyUriSpec.class.getClassLoader(),
                new Class<?>[]{WebClient.RequestBodyUriSpec.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "uri", "header", "bodyValue" -> proxy;
                    case "retrieve" -> responseSpec(response);
                    default -> method.getDeclaringClass() == Object.class
                            ? objectMethod(proxy, method.getName(), args)
                            : throwUnsupported(method.getName());
                });
    }

    private WebClient.ResponseSpec responseSpec(Map<String, Object> response) {
        return (WebClient.ResponseSpec) Proxy.newProxyInstance(
                WebClient.ResponseSpec.class.getClassLoader(), new Class<?>[]{WebClient.ResponseSpec.class},
                (proxy, method, args) -> {
                    if (method.getName().equals("bodyToMono")) return Mono.just(response);
                    if (method.getDeclaringClass() == Object.class) return objectMethod(proxy, method.getName(), args);
                    throw new UnsupportedOperationException(method.getName());
                });
    }

    private Object objectMethod(Object proxy, String method, Object[] args) {
        return switch (method) {
            case "toString" -> "ComposeServiceUsageTest proxy";
            case "hashCode" -> System.identityHashCode(proxy);
            case "equals" -> proxy == args[0];
            default -> null;
        };
    }

    private Object throwUnsupported(String method) {
        throw new UnsupportedOperationException(method);
    }

    private Map<String, Object> response(boolean includeUsage) {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("model", "deepseek-flash");
        body.put("choices", List.of(Map.of("message", Map.of("content", "Una propuesta técnica breve."))));
        if (includeUsage) body.put("usage", Map.of("prompt_tokens", 47, "completion_tokens", 16, "total_tokens", 63));
        return body;
    }

    private ComposeRequest request() {
        return new ComposeRequest("Tema", "Contexto verificable", ComposeRequest.Tone.PROFESSIONAL,
                "Desarrolladores", ComposeRequest.Goal.SHARE_LEARNING, "", null, null);
    }

    private void set(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
