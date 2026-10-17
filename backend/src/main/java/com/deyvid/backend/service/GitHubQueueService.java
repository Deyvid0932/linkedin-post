package com.deyvid.backend.service;

import com.deyvid.backend.dto.request.QueueUploadRequest;
import com.deyvid.backend.entity.*;
import com.deyvid.backend.repository.*;
import org.springframework.beans.factory.annotation.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;
import java.time.*;
import java.time.format.DateTimeParseException;
import java.util.*;

/** Writes only the reviewed queue; never workflows, secrets or publication receipts. */
@Service
public class GitHubQueueService {
    private static final long MAX_QUEUE_BYTES = 50L * 1024 * 1024;
    private final TenantRepository tenants;
    private final GitHubRepositoryRepo repositories;
    private final GitHubCredentialRepository credentials;
    private final LinkedInCredentialRepository accounts;
    private final DraftPreviewRepository drafts;
    private final GitHubLinkedInBindingRepository bindings;
    private final PublicationAttemptService attempts;
    private final EncryptionService encryption;
    private final SafeImageService images;
    private final WebClient github;
    private final JsonMapper json = JsonMapper.builder().build();
    @Value("${app.scheduler.mode:manual}") private String mode;

    public GitHubQueueService(TenantRepository tenants, GitHubRepositoryRepo repositories, GitHubCredentialRepository credentials,
            LinkedInCredentialRepository accounts, DraftPreviewRepository drafts, GitHubLinkedInBindingRepository bindings, PublicationAttemptService attempts,
            EncryptionService encryption, SafeImageService images, @Qualifier("gitHubWebClient") WebClient github) {
        this.tenants = tenants; this.repositories = repositories; this.credentials = credentials; this.accounts = accounts;
        this.drafts = drafts; this.bindings = bindings; this.attempts = attempts; this.encryption = encryption; this.images = images; this.github = github;
    }
    public record UploadResult(int postCount, String branch, String url) {}
    public record QueuePost(String id, String text, boolean hasImage, Instant publishAt, String status,
                            Instant attemptedAt, String postUrn) {}
    public record QueueSnapshot(String repositoryId, String repository, String branch, String revision,
                                String queueSha, List<QueuePost> posts) {}
    public record ScheduleResult(QueueSnapshot queue, String commitUrl) {}

    @Transactional(readOnly = true)
    public QueueSnapshot list(UUID tenantId, UUID repositoryId) {
        var repo = repository(tenantId, repositoryId);
        var client = githubClient(tenantId);
        String repoPath = repoPath(repo);
        String branch = defaultBranch(client, repoPath);
        String head = branchHead(client, repoPath, branch);
        Map<?, ?> queueFile = readFile(client, repoPath, "automation/queue.json", head, true);
        Map<?, ?> stateFile = readFile(client, repoPath, "automation/state.json", head, false);
        Map<String, Object> queue = parseJson(queueFile);
        Map<String, Object> state = parseJson(stateFile);
        List<QueuePost> posts = toPosts(queue, state);
        return new QueueSnapshot(repositoryId.toString(), repo.getRepoOwner() + "/" + repo.getRepoName(), branch, head,
                queueFile == null ? null : (String) queueFile.get("sha"), posts);
    }

    @Transactional
    public ScheduleResult schedule(UUID tenantId, UUID repositoryId, UUID postId, String publishAt, String timezone, String expectedRevision) {
        var repo = repository(tenantId, repositoryId);
        ZoneId zone;
        Instant scheduled;
        try {
            zone = ZoneId.of(timezone);
            scheduled = OffsetDateTime.parse(publishAt).toInstant();
        } catch (DateTimeException ex) {
            throw new IllegalArgumentException("La fecha o zona horaria no es válida");
        }
        if (!scheduled.isAfter(Instant.now())) throw new IllegalArgumentException("Elige una fecha futura");
        var client = githubClient(tenantId);
        String repoPath = repoPath(repo);
        String branch = defaultBranch(client, repoPath);
        String head = branchHead(client, repoPath, branch);
        if (expectedRevision == null || !head.equals(expectedRevision)) throw new ResponseStatusException(HttpStatus.CONFLICT, "El repositorio cambió; recarga el calendario antes de guardar.");
        Map<?, ?> queueFile = readFile(client, repoPath, "automation/queue.json", head, true);
        Map<?, ?> stateFile = readFile(client, repoPath, "automation/state.json", head, false);
        Map<String, Object> queue = parseJson(queueFile);
        Map<String, Object> state = parseJson(stateFile);
        Object rawPosts = queue.get("posts");
        if (!(rawPosts instanceof List<?> posts)) throw new IllegalArgumentException("La cola de GitHub no tiene un formato válido");
        Map<String, Object> target = null;
        for (Object value : posts) {
            if (!(value instanceof Map<?, ?> candidate)) continue;
            if (postId.toString().equals(candidate.get("id"))) { target = (Map<String, Object>) candidate; break; }
        }
        if (target == null || !Boolean.TRUE.equals(target.get("approved"))) throw new IllegalArgumentException("La publicación ya no está pendiente en GitHub");
        Map<String, Object> receipts = receiptMap(state);
        if (receipts.containsKey(postId.toString())) throw new IllegalArgumentException("No se puede reprogramar una publicación que ya tiene un intento registrado");
        for (Object value : posts) {
            if (!(value instanceof Map<?, ?> candidate) || postId.toString().equals(candidate.get("id"))) continue;
            Object other = candidate.get("publishAt");
            if (other instanceof String timestamp) {
                try {
                    if (OffsetDateTime.parse(timestamp).toInstant().atZone(zone).toLocalDate().equals(scheduled.atZone(zone).toLocalDate()))
                        throw new IllegalArgumentException("La cola permite una publicación por día en la zona seleccionada");
                } catch (DateTimeParseException ex) { throw new IllegalArgumentException("La cola contiene una fecha inválida; corrígela en GitHub antes de reprogramar"); }
            }
        }
        target.put("publishAt", scheduled.toString());
        byte[] content = json.writeValueAsBytes(queue);
        String commit = commitFile(client, repoPath, branch, head, "automation/queue.json", content,
                "content: reschedule approved LinkedIn post");
        return new ScheduleResult(list(tenantId, repositoryId), "https://github.com/" + repo.getRepoOwner() + "/" + repo.getRepoName() + "/commit/" + commit);
    }

    @Transactional
    public UploadResult upload(UUID tenantId, QueueUploadRequest request) {
        if (!"manual".equals(mode)) throw new IllegalArgumentException("Usa SCHEDULER_MODE=manual para publicar mediante la cola exportada");
        tenants.findByIdForUpdate(tenantId).orElseThrow(() -> new IllegalArgumentException("Cuenta no disponible"));
        var repo = repositories.findById(request.repositoryId()).filter(r -> r.getTenant().getId().equals(tenantId) && Boolean.TRUE.equals(r.getIsActive()))
                .orElseThrow(() -> new IllegalArgumentException("Repositorio no disponible"));
        var account = accounts.findById(request.accountId()).filter(a -> a.getTenant().getId().equals(tenantId)
                        && Boolean.TRUE.equals(a.getIsEnabled()) && Boolean.TRUE.equals(a.getIsValid())
                        && a.getAccountType() == com.deyvid.backend.entity.enums.LinkedInAccountType.PERSON)
                .orElseThrow(() -> new IllegalArgumentException("Cuenta personal de LinkedIn no disponible"));
        var binding = bindings.findByTenantIdAndRepositoryId(tenantId, repo.getId())
                .orElseThrow(() -> new IllegalArgumentException("Vincula una cuenta personal de LinkedIn con este repositorio en Canales de GitHub antes de subir la cola"));
        if (!binding.getLinkedInCredential().getId().equals(account.getId()))
            throw new IllegalArgumentException("La cola debe usar la cuenta vinculada a este repositorio en Canales de GitHub");
        if (!"SYNCED".equals(binding.getSyncStatus()))
            throw new IllegalArgumentException("La cuenta aún no se sincroniza con GitHub Actions. Reintenta la sincronización en Canales de GitHub");
        if (!repo.getRepoOwner().matches("[A-Za-z0-9_.-]+") || !repo.getRepoName().matches("[A-Za-z0-9_.-]+")) throw new IllegalArgumentException("Repositorio inválido");
        ZoneId zone = ZoneId.of(request.timezone());
        if (request.firstPostAt().toInstant().isBefore(Instant.now()) || request.draftIds().isEmpty()
                || request.draftIds().size() > 100 || new HashSet<>(request.draftIds()).size() != request.draftIds().size()) throw new IllegalArgumentException("Fecha o selección de posts inválida");
        List<Map<String, Object>> posts = new ArrayList<>();
        long estimatedQueueBytes = 128;
        var first = request.firstPostAt().atZoneSameInstant(zone);
        for (UUID id : request.draftIds()) {
            var draft = drafts.findOwnedForUpdate(id, tenantId).orElseThrow(() -> new IllegalArgumentException("Borrador no disponible"));
            if (!draft.isQueued() || !account.getId().equals(draft.getTargetCredentialId()) || attempts.hasAttempts(id)) {
                throw new IllegalArgumentException("Solo puedes subir posts aprobados para esa cuenta y sin intentos del backend");
            }
            if (draft.getGeneratedText() == null || draft.getGeneratedText().isBlank() || draft.getGeneratedText().length() > 3000) throw new IllegalArgumentException("Post vacío o demasiado largo");
            if (draft.getImageUrl() != null && !draft.getImageUrl().isBlank() && !draft.getImageUrl().startsWith("data:image/")) throw new IllegalArgumentException("Adjunta las imágenes desde tu dispositivo antes de subir la cola");
            images.validate(draft.getImageUrl());
            Map<String, Object> post = new LinkedHashMap<>();
            post.put("id", id.toString()); post.put("approved", true); post.put("text", draft.getGeneratedText());
            post.put("imageDataUrl", draft.getImageUrl()); post.put("publishAt", first.plusDays(posts.size()).toInstant().toString());
            estimatedQueueBytes += json.writeValueAsBytes(post).length + 1L;
            if (estimatedQueueBytes > MAX_QUEUE_BYTES) throw new IllegalArgumentException("La cola supera 50 MB. Reduce el lote antes de subirlo");
            posts.add(post);
        }
        byte[] bytes = json.writeValueAsBytes(Map.of("version", 1, "authorUrn", account.getEffectiveAuthorUrn(), "posts", posts));
        if (bytes.length > MAX_QUEUE_BYTES) throw new IllegalArgumentException("La cola supera 50 MB. Reduce el lote");
        var credential = credentials.findByTenantId(tenantId).filter(c -> Boolean.TRUE.equals(c.getIsValid()))
                .orElseThrow(() -> new IllegalArgumentException("Conecta GitHub con permiso Contents: write en el repositorio elegido"));
        String token = encryption.decrypt(credential.getPersonalAccessTokenEnc());
        if (token == null || token.isBlank()) throw new IllegalArgumentException("Reconecta GitHub");
        WebClient client = authorized(token);
        String repoPath = repoPath(repo);
        try {
            String branch = defaultBranch(client, repoPath);
            String head = branchHead(client, repoPath, branch);
            commitFile(client, repoPath, branch, head, "automation/queue.json", bytes,
                    "content: update author-approved LinkedIn queue");
            return new UploadResult(posts.size(), branch, "https://github.com/" + repo.getRepoOwner() + "/" + repo.getRepoName() + "/actions");
        } catch (Exception e) {
            // No retry: a timed-out write may have succeeded. Inspect the repository first.
            throw new IllegalArgumentException("No se confirmó la subida. Revisa GitHub antes de volver a intentarlo y comprueba permisos Contents: write y reglas de la rama.");
        }
    }

    private GitHubRepository repository(UUID tenantId, UUID repositoryId) {
        return repositories.findById(repositoryId).filter(r -> r.getTenant().getId().equals(tenantId) && Boolean.TRUE.equals(r.getIsActive()))
                .orElseThrow(() -> new IllegalArgumentException("Repositorio no disponible"));
    }

    private String repoPath(GitHubRepository repo) { return "/repos/" + repo.getRepoOwner() + "/" + repo.getRepoName(); }

    private WebClient githubClient(UUID tenantId) {
        var credential = credentials.findByTenantId(tenantId).filter(c -> Boolean.TRUE.equals(c.getIsValid()))
                .orElseThrow(() -> new IllegalArgumentException("Conecta GitHub con permiso Contents: write en el repositorio elegido"));
        String token = encryption.decrypt(credential.getPersonalAccessTokenEnc());
        if (token == null || token.isBlank()) throw new IllegalArgumentException("Reconecta GitHub");
        return authorized(token);
    }

    private WebClient authorized(String token) {
        return github.mutate().defaultHeader("Authorization", "Bearer " + token)
                .defaultHeader("X-GitHub-Api-Version", "2022-11-28").build();
    }

    private String defaultBranch(WebClient client, String repoPath) {
        Map<?, ?> metadata = client.get().uri(repoPath).retrieve().bodyToMono(Map.class).block();
        String branch = metadata == null ? null : (String) metadata.get("default_branch");
        if (branch == null || branch.isBlank() || branch.contains("..")) throw new IllegalArgumentException("Rama predeterminada no disponible");
        return branch;
    }

    private String branchHead(WebClient client, String repoPath, String branch) {
        Map<?, ?> ref = client.get().uri(repoPath + "/git/ref/heads/" + branch).retrieve().bodyToMono(Map.class).block();
        Map<?, ?> object = ref == null ? null : (Map<?, ?>) ref.get("object");
        return object == null ? null : (String) object.get("sha");
    }

    private Map<?, ?> readFile(WebClient client, String repoPath, String path, String revision, boolean required) {
        try {
            return client.get().uri(b -> b.path(repoPath + "/contents/" + path).queryParam("ref", revision).build())
                    .retrieve().bodyToMono(Map.class).block();
        } catch (WebClientResponseException.NotFound missing) {
            if (required) throw new IllegalArgumentException("No se encontró automation/queue.json en la rama predeterminada");
            return null;
        }
    }

    private Map<String, Object> parseJson(Map<?, ?> file) {
        if (file == null) return new LinkedHashMap<>();
        try {
            Object encoded = file.get("content");
            if (!(encoded instanceof String content)) throw new IllegalArgumentException("Archivo de estado no válido");
            return json.readValue(Base64.getMimeDecoder().decode(content), Map.class);
        } catch (Exception ex) { throw new IllegalArgumentException("La cola o los recibos de GitHub no tienen un JSON válido"); }
    }

    private List<QueuePost> toPosts(Map<String, Object> queue, Map<String, Object> state) {
        if (!Objects.equals(queue.get("version"), 1)) throw new IllegalArgumentException("Versión de cola no compatible");
        Object raw = queue.get("posts");
        if (!(raw instanceof List<?> values)) throw new IllegalArgumentException("La cola de GitHub no tiene un formato válido");
        Map<String, Object> receipts = receiptMap(state);
        List<QueuePost> result = new ArrayList<>();
        for (Object value : values) {
            if (!(value instanceof Map<?, ?> post) || !(post.get("id") instanceof String id)) continue;
            Map<?, ?> receipt = receipts.get(id) instanceof Map<?, ?> r ? r : Map.of();
            Instant date = parseInstant(post.get("publishAt"));
            String fallbackStatus = !Boolean.TRUE.equals(post.get("approved")) ? "UNAPPROVED" : date == null ? "INVALID_DATE" : "SCHEDULED";
            String status = Objects.toString(receipt.get("status"), fallbackStatus);
            result.add(new QueuePost(id, Objects.toString(post.get("text"), ""), post.get("imageDataUrl") instanceof String image && !image.isBlank(),
                    date, status, parseInstant(receipt.get("attemptedAt")),
                    receipt.get("postUrn") instanceof String urn ? urn : null));
        }
        result.sort(Comparator.comparing(QueuePost::publishAt, Comparator.nullsLast(Comparator.naturalOrder())));
        return result;
    }

    private Instant parseInstant(Object value) {
        try { return value instanceof String text ? OffsetDateTime.parse(text).toInstant() : null; }
        catch (DateTimeParseException ex) { return null; }
    }

    private Map<String, Object> receiptMap(Map<String, Object> state) {
        if (state.isEmpty()) return Map.of();
        Object receipts = state.get("receipts");
        if (!(receipts instanceof Map<?, ?> values)) throw new IllegalArgumentException("Los recibos de GitHub no tienen un formato válido");
        Map<String, Object> result = new HashMap<>();
        values.forEach((key, value) -> { if (key instanceof String id) result.put(id, value); });
        return result;
    }

    private String commitFile(WebClient client, String repoPath, String branch, String expectedHead, String path, byte[] bytes, String message) {
        try {
            Map<?, ?> oldCommit = client.get().uri(repoPath + "/git/commits/" + expectedHead).retrieve().bodyToMono(Map.class).block();
            Map<?, ?> oldTree = oldCommit == null ? null : (Map<?, ?>) oldCommit.get("tree");
            String baseTree = oldTree == null ? null : (String) oldTree.get("sha");
            Map<?, ?> blob = client.post().uri(repoPath + "/git/blobs").bodyValue(Map.of("content", Base64.getEncoder().encodeToString(bytes), "encoding", "base64"))
                    .retrieve().bodyToMono(Map.class).block();
            String blobSha = blob == null ? null : (String) blob.get("sha");
            if (blobSha == null) throw new IllegalStateException("GitHub no confirmó el contenido");
            Map<String, Object> treeBody = new LinkedHashMap<>();
            if (baseTree != null) treeBody.put("base_tree", baseTree);
            treeBody.put("tree", List.of(Map.of("path", path, "mode", "100644", "type", "blob", "sha", blobSha)));
            Map<?, ?> tree = client.post().uri(repoPath + "/git/trees").bodyValue(treeBody).retrieve().bodyToMono(Map.class).block();
            String treeSha = tree == null ? null : (String) tree.get("sha");
            if (treeSha == null) throw new IllegalStateException("GitHub no confirmó el árbol");
            Map<?, ?> commit = client.post().uri(repoPath + "/git/commits").bodyValue(Map.of("message", message, "tree", treeSha, "parents", List.of(expectedHead)))
                    .retrieve().bodyToMono(Map.class).block();
            String commitSha = commit == null ? null : (String) commit.get("sha");
            if (commitSha == null) throw new IllegalStateException("GitHub no confirmó el commit");
            client.patch().uri(repoPath + "/git/refs/heads/" + branch)
                    .bodyValue(Map.of("sha", commitSha, "force", false)).retrieve().toBodilessEntity().block();
            return commitSha;
        } catch (WebClientResponseException.Conflict | WebClientResponseException.UnprocessableEntity conflict) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "GitHub cambió mientras se guardaba; recarga antes de reintentar.");
        }
    }
}
