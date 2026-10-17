package com.deyvid.backend.service;

import com.deyvid.backend.entity.GitHubRepository;
import com.deyvid.backend.repository.GitHubCredentialRepository;
import com.deyvid.backend.repository.GitHubRepositoryRepo;
import com.deyvid.backend.repository.LinkedInCredentialRepository;
import com.deyvid.backend.service.ai.NanoGptImageModels;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import tools.jackson.databind.json.JsonMapper;

import java.time.ZoneId;
import java.util.*;
import java.util.regex.Pattern;

@Service
public class GitHubAutomationConfigService {
    public record Config(String approvalMode, int targetCharacters, String prompt, String imageModel,
                         String timezone, String publishTime, boolean enabled) {}
    private record FileContent(String sha, byte[] bytes) {}
    private static final Config DEFAULT = new Config("REQUIRE_APPROVAL", 1200, "", "qwen-image-2.1/text-to-image",
            "America/Lima", "08:00", false);
    private static final Pattern TIME = Pattern.compile("^(?:[01]\\d|2[0-3]):[0-5]\\d$");
    private final GitHubRepositoryRepo repositories;
    private final LinkedInCredentialRepository linkedInAccounts;
    private final GitHubCredentialRepository credentials;
    private final EncryptionService encryption;
    private final WebClient github;
    private final JsonMapper json = JsonMapper.builder().build();

    public GitHubAutomationConfigService(GitHubRepositoryRepo repositories, LinkedInCredentialRepository linkedInAccounts, GitHubCredentialRepository credentials,
            EncryptionService encryption, @Qualifier("gitHubWebClient") WebClient github) {
        this.repositories = repositories; this.linkedInAccounts = linkedInAccounts; this.credentials = credentials; this.encryption = encryption; this.github = github;
    }

    public Config get(UUID tenantId, UUID repositoryId) {
        RepoAccess access = access(tenantId, repositoryId);
        try {
            FileContent file = read(access, "automation/autopost-config.json");
            Map<?, ?> data = json.readValue(file.bytes(), Map.class);
            return new Config(text(data, "approvalMode", DEFAULT.approvalMode()), number(data, "targetCharacters", DEFAULT.targetCharacters()),
                    text(data, "prompt", ""), text(data, "imageModel", DEFAULT.imageModel()),
                    text(data, "timezone", DEFAULT.timezone()), text(data, "publishTime", DEFAULT.publishTime()), bool(data, "enabled", false));
        } catch (WebClientResponseException.NotFound e) { return DEFAULT; }
    }

    public Config save(UUID tenantId, UUID repositoryId, Config config) {
        validate(config);
        RepoAccess access = access(tenantId, repositoryId);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("version", 1); data.put("approvalMode", config.approvalMode());
        data.put("targetCharacters", config.targetCharacters()); data.put("prompt", config.prompt());
        data.put("imageModel", config.imageModel()); data.put("timezone", config.timezone());
        data.put("publishTime", config.publishTime()); data.put("enabled", config.enabled());
        write(access, "automation/autopost-config.json", data, "chore: update AutoPost Actions configuration [skip ci]");
        return config;
    }

    public List<Map<String, Object>> getPendingReview(UUID tenantId, UUID repositoryId) {
        RepoAccess access = access(tenantId, repositoryId);
        try {
            Map<?, ?> data = readJson(access, "automation/review.json", Map.of("posts", List.of()));
            Object value = data.get("posts");
            if (!(value instanceof List<?> posts)) return List.of();
            return posts.stream().filter(Map.class::isInstance).map(Map.class::cast)
                    .filter(post -> "PENDING".equals(post.get("status")))
                    .map(post -> (Map<String, Object>) post).toList();
        } catch (WebClientResponseException.NotFound e) { return List.of(); }
    }

    public Map<String, Object> approveReview(UUID tenantId, UUID repositoryId, String postId) {
        RepoAccess access = access(tenantId, repositoryId);
        Map<String, Object> review = mutable(readJson(access, "automation/review.json", Map.of("version", 1, "posts", List.of())));
        List<Map<String, Object>> posts = mutableList(review.get("posts"));
        Map<String, Object> post = posts.stream().filter(p -> postId.equals(p.get("id"))).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("El borrador de GitHub Actions ya no existe"));
        if ("APPROVED".equals(post.get("status"))) return post;
        if (!"PENDING".equals(post.get("status"))) throw new IllegalArgumentException("Este borrador ya no está pendiente de aprobación");
        Object rawText = post.get("text");
        if (!(rawText instanceof String postText) || postText.isBlank() || postText.length() > 3000)
            throw new IllegalArgumentException("El texto del borrador está vacío o supera 3000 caracteres");
        String imageDataUrl = post.get("imageDataUrl") instanceof String image ? image : null;
        if (imageDataUrl == null) throw new IllegalArgumentException("El borrador no contiene una imagen válida");
        new SafeImageService().validate(imageDataUrl);
        try { java.time.OffsetDateTime.parse(String.valueOf(post.get("publishAt"))); }
        catch (Exception e) { throw new IllegalArgumentException("La fecha de publicación del borrador no es válida"); }
        var account = linkedInAccounts.findByTenantIdAndIsEnabledTrue(tenantId).stream()
                .filter(a -> Boolean.TRUE.equals(a.getIsPrimary())).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Configura una cuenta de LinkedIn principal antes de aprobar"));
        Map<String, Object> queue = mutable(readJson(access, "automation/queue.json", Map.of("version", 1, "authorUrn", account.getEffectiveAuthorUrn(), "posts", List.of())));
        if (!account.getEffectiveAuthorUrn().equals(queue.get("authorUrn"))) throw new IllegalArgumentException("La cola existente pertenece a otra cuenta. Revísala antes de mezclar publicaciones");
        List<Map<String, Object>> queued = mutableList(queue.get("posts"));
        if (queued.stream().noneMatch(item -> postId.equals(item.get("id")))) {
            Map<String, Object> queuedPost = new LinkedHashMap<>();
            // The candidate was generated around its target time. Approval is the explicit
            // authorization to publish it, so make it due now even if review took over 24h.
            String approvedPublishAt = java.time.Instant.now().toString();
            queuedPost.put("id", postId); queuedPost.put("approved", true); queuedPost.put("text", post.get("text"));
            queuedPost.put("imageDataUrl", imageDataUrl); queuedPost.put("publishAt", approvedPublishAt);
            queued.add(queuedPost); queue.put("posts", queued);
            write(access, "automation/queue.json", queue, "content: approve Actions-generated LinkedIn post [skip ci]");
        }
        post.put("status", "APPROVED"); post.put("approvedAt", java.time.Instant.now().toString());
        review.put("posts", posts);
        write(access, "automation/review.json", review, "content: record approval for Actions-generated post [skip ci]");
        return Map.of("id", postId, "status", "APPROVED", "message", "Aprobado y agregado a la cola de GitHub Actions.");
    }

    public List<Map<String, Object>> getHistory(UUID tenantId, UUID repositoryId) {
        RepoAccess access = access(tenantId, repositoryId);
        List<Map<String, Object>> result = new ArrayList<>();
        Map<?, ?> history = readJson(access, "automation/autopost-history.json", Map.of("posts", List.of()));
        Object value = history.get("posts");
        if (value instanceof List<?> posts) for (Object item : posts) if (item instanceof Map<?, ?> map) result.add(mutable(map));

        Map<?, ?> queue = readJson(access, "automation/queue.json", Map.of("posts", List.of()));
        Map<?, ?> state = readJson(access, "automation/state.json", Map.of("receipts", Map.of()));
        Map<?, ?> receipts = state.get("receipts") instanceof Map<?, ?> r ? r : Map.of();
        Map<String, Map<?, ?>> queueItems = new HashMap<>();
        if (queue.get("posts") instanceof List<?> queued) for (Object item : queued)
            if (item instanceof Map<?, ?> map && map.get("id") != null) queueItems.put(String.valueOf(map.get("id")), map);
        for (var entry : receipts.entrySet()) {
            if (!(entry.getValue() instanceof Map<?, ?> receipt)) continue;
            String id = String.valueOf(entry.getKey()); Map<?, ?> post = queueItems.get(id);
            if (post == null) continue;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", id); item.put("source", "GITHUB_ACTIONS"); item.put("status", receipt.get("status"));
            item.put("text", post.get("text")); item.put("imageDataUrl", post.get("imageDataUrl"));
            item.put("publishAt", post.get("publishAt")); item.put("publishedAt", receipt.get("attemptedAt"));
            item.put("postUrn", receipt.get("postUrn"));
            result.add(item);
        }
        Map<?, ?> automaticState = readJson(access, "automation/autopost-state.json", Map.of("days", Map.of()));
        if (automaticState.get("days") instanceof Map<?, ?> days) for (var entry : days.entrySet()) {
            if (!(entry.getValue() instanceof Map<?, ?> status)) continue;
            String dailyStatus = String.valueOf(status.get("status"));
            if ("SUCCESS".equals(dailyStatus)) continue; // Success entries include full text in autopost-history.json.
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", "daily-" + entry.getKey()); item.put("source", "GITHUB_ACTIONS");
            item.put("status", dailyStatus); item.put("title", status.get("title"));
            item.put("publishedAt", status.get("attemptedAt")); item.put("createdAt", status.get("createdAt"));
            item.put("postId", status.get("postId")); result.add(item);
        }
        result.sort(Comparator.comparing(item -> String.valueOf(item.getOrDefault("publishedAt", item.get("publishAt"))), Comparator.reverseOrder()));
        return result;
    }

    private Map<?, ?> readJson(RepoAccess access, String path, Map<String, Object> fallback) {
        try {
            FileContent file = read(access, path);
            return json.readValue(file.bytes(), Map.class);
        } catch (WebClientResponseException.NotFound e) { return fallback; }
    }

    private void write(RepoAccess access, String path, Map<String, Object> data, String message) {
        FileContent existing = null;
        try { existing = read(access, path); } catch (WebClientResponseException.NotFound ignored) { }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", message); body.put("branch", access.branch());
        body.put("content", Base64.getEncoder().encodeToString(json.writeValueAsBytes(data)));
        if (existing != null && existing.sha() != null) body.put("sha", existing.sha());
        try {
            github.put().uri("/repos/" + access.repo().getRepoOwner() + "/" + access.repo().getRepoName() + "/contents/" + path)
                    .header("Authorization", "Bearer " + access.token()).bodyValue(body).retrieve().toBodilessEntity().block();
        } catch (Exception e) {
            throw new IllegalArgumentException("No se pudo guardar el archivo de automatización. Revisa permisos Contents: write y reglas de rama.");
        }
    }

    private FileContent read(RepoAccess access, String path) {
        Map<?, ?> metadata = github.get().uri("/repos/" + access.repo().getRepoOwner() + "/" + access.repo().getRepoName())
                .header("Authorization", "Bearer " + access.token()).retrieve().bodyToMono(Map.class).block();
        String branch = String.valueOf(metadata.get("default_branch"));
        String filePath = "/repos/" + access.repo().getRepoOwner() + "/" + access.repo().getRepoName() + "/contents/" + path;
        Map<?, ?> file = github.get().uri(b -> b.path(filePath).queryParam("ref", branch).build())
                .header("Authorization", "Bearer " + access.token()).retrieve().bodyToMono(Map.class).block();
        String content = String.valueOf(file.get("content"));
        byte[] bytes;
        if (!content.isBlank() && !"null".equals(content)) {
            bytes = Base64.getMimeDecoder().decode(content);
        } else {
            bytes = github.get().uri(b -> b.path(filePath).queryParam("ref", branch).build())
                    .header("Authorization", "Bearer " + access.token())
                    .header("Accept", "application/vnd.github.raw")
                    .retrieve().bodyToMono(byte[].class).block();
        }
        return new FileContent(String.valueOf(file.get("sha")), bytes);
    }

    private record RepoAccess(GitHubRepository repo, String token, String branch) {}
    private RepoAccess access(UUID tenantId, UUID repositoryId) {
        GitHubRepository repo = repositories.findById(repositoryId)
                .filter(r -> r.getTenant().getId().equals(tenantId) && Boolean.TRUE.equals(r.getIsActive()))
                .orElseThrow(() -> new IllegalArgumentException("Repositorio GitHub no disponible"));
        if (!repo.getRepoOwner().matches("[A-Za-z0-9_.-]+") || !repo.getRepoName().matches("[A-Za-z0-9_.-]+"))
            throw new IllegalArgumentException("Repositorio GitHub inválido");
        var credential = credentials.findByTenantId(tenantId).filter(c -> Boolean.TRUE.equals(c.getIsValid()))
                .orElseThrow(() -> new IllegalArgumentException("Conecta GitHub antes de configurar Actions"));
        String token = encryption.decrypt(credential.getPersonalAccessTokenEnc());
        Map<?, ?> metadata = github.get().uri("/repos/" + repo.getRepoOwner() + "/" + repo.getRepoName())
                .header("Authorization", "Bearer " + token).retrieve().bodyToMono(Map.class).block();
        String branch = String.valueOf(metadata.get("default_branch"));
        if (branch.isBlank() || "null".equals(branch)) throw new IllegalArgumentException("No se encontró la rama predeterminada del repositorio");
        return new RepoAccess(repo, token, branch);
    }

    private void validate(Config c) {
        if (c == null || !("REQUIRE_APPROVAL".equals(c.approvalMode()) || "AUTOMATIC".equals(c.approvalMode()))) throw new IllegalArgumentException("Selecciona un modo de publicación válido");
        if (c.targetCharacters() < 100 || c.targetCharacters() > 3000) throw new IllegalArgumentException("El límite debe estar entre 100 y 3000 caracteres");
        if (c.prompt() == null || c.prompt().length() > 5000) throw new IllegalArgumentException("El prompt no puede superar 5000 caracteres");
        if (!TIME.matcher(Objects.toString(c.publishTime(), "")).matches()) throw new IllegalArgumentException("La hora debe tener formato HH:mm");
        try { ZoneId.of(c.timezone()); } catch (Exception e) { throw new IllegalArgumentException("Zona horaria inválida"); }
        if (!NanoGptImageModels.isSupported(c.imageModel())) throw new IllegalArgumentException("Modelo de imagen NanoGPT no disponible");
    }

    private static String text(Map<?, ?> data, String key, String fallback) { Object v=data.get(key); return v instanceof String s ? s : fallback; }
    private static int number(Map<?, ?> data, String key, int fallback) { Object v=data.get(key); return v instanceof Number n ? n.intValue() : fallback; }
    private static boolean bool(Map<?, ?> data, String key, boolean fallback) { Object v=data.get(key); return v instanceof Boolean b ? b : fallback; }

    private static Map<String, Object> mutable(Map<?, ?> input) { return new LinkedHashMap<>((Map<String, Object>) input); }
    private static List<Map<String, Object>> mutableList(Object value) {
        List<Map<String, Object>> result = new ArrayList<>();
        if (value instanceof List<?> list) for (Object item : list) if (item instanceof Map<?, ?> map) result.add(mutable(map));
        return result;
    }
}
