package com.deyvid.backend.service;

import com.goterl.lazysodium.SodiumJava;
import com.deyvid.backend.entity.GitHubLinkedInBinding;
import com.deyvid.backend.entity.LinkedInCredential;
import com.deyvid.backend.repository.GitHubCredentialRepository;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

@Service
public class GitHubActionsCredentialService {
    private static final String ENVIRONMENT = "production";
    private final GitHubCredentialRepository credentials;
    private final EncryptionService encryption;
    private final WebClient github;

    public GitHubActionsCredentialService(GitHubCredentialRepository credentials, EncryptionService encryption,
            @Qualifier("gitHubWebClient") WebClient github) {
        this.credentials = credentials; this.encryption = encryption; this.github = github;
    }

    public void sync(GitHubLinkedInBinding binding) {
        var credential = credentials.findByTenantId(binding.getTenant().getId())
                .filter(c -> Boolean.TRUE.equals(c.getIsValid()))
                .orElseThrow(() -> new IllegalStateException("GITHUB_NOT_CONNECTED"));
        String token = encryption.decrypt(credential.getPersonalAccessTokenEnc());
        String owner = binding.getRepository().getRepoOwner();
        String repo = binding.getRepository().getRepoName();
        String base = "/repos/" + owner + "/" + repo + "/environments/" + ENVIRONMENT;
        ensureEnvironment(token, owner, repo);
        // A new or reconnected destination must never silently resume a previously enabled publisher.
        updateVariable(token, base, "PUBLISH_ENABLED", "false");
        Map<?, ?> publicKey = github.get().uri(base + "/secrets/public-key").headers(h -> h.setBearerAuth(token))
                .retrieve().bodyToMono(Map.class).block();
        String key = string(publicKey, "key");
        String keyId = string(publicKey, "key_id");
        byte[] publicBytes = Base64.getDecoder().decode(key);
        byte[] message = encryption.decrypt(binding.getLinkedInCredential().getAccessTokenEnc()).getBytes(StandardCharsets.UTF_8);
        byte[] sealed = new byte[message.length + 48];
        int result = new SodiumJava().crypto_box_seal(sealed, message, message.length, publicBytes);
        java.util.Arrays.fill(message, (byte) 0);
        if (result != 0) throw new IllegalStateException("GITHUB_ENCRYPTION_FAILED");
        Map<String, Object> secret = Map.of("encrypted_value", Base64.getEncoder().encodeToString(sealed), "key_id", keyId);
        github.put().uri(base + "/secrets/LINKEDIN_ACCESS_TOKEN").headers(h -> h.setBearerAuth(token)).bodyValue(secret)
                .retrieve().toBodilessEntity().block();

        String urn = binding.getLinkedInCredential().getEffectiveAuthorUrn();
        updateVariable(token, base, "LINKEDIN_AUTHOR_URN", urn);
        updateVariable(token, base, "LINKEDIN_PERSON_URN", urn);
    }

    public void removeAndPause(GitHubLinkedInBinding binding) {
        var credential = credentials.findByTenantId(binding.getTenant().getId())
                .filter(c -> Boolean.TRUE.equals(c.getIsValid())).orElseThrow(() -> new IllegalStateException("GITHUB_NOT_CONNECTED"));
        String token = encryption.decrypt(credential.getPersonalAccessTokenEnc());
        String owner = binding.getRepository().getRepoOwner();
        String repo = binding.getRepository().getRepoName();
        ensureEnvironment(token, owner, repo);
        String base = "/repos/" + owner + "/" + repo
                + "/environments/" + ENVIRONMENT;
        updateVariable(token, base, "PUBLISH_ENABLED", "false");
        try {
            github.delete().uri(base + "/secrets/LINKEDIN_ACCESS_TOKEN").headers(h -> h.setBearerAuth(token))
                    .retrieve().toBodilessEntity().block();
        } catch (org.springframework.web.reactive.function.client.WebClientResponseException.NotFound ignored) {
            // Disconnect is idempotent when an operator already removed the managed secret.
        }
    }

    public void pause(GitHubLinkedInBinding binding) {
        var credential = credentials.findByTenantId(binding.getTenant().getId())
                .filter(c -> Boolean.TRUE.equals(c.getIsValid())).orElseThrow(() -> new IllegalStateException("GITHUB_NOT_CONNECTED"));
        String token = encryption.decrypt(credential.getPersonalAccessTokenEnc());
        String base = "/repos/" + binding.getRepository().getRepoOwner() + "/" + binding.getRepository().getRepoName()
                + "/environments/" + ENVIRONMENT;
        updateVariable(token, base, "PUBLISH_ENABLED", "false");
    }

    private void updateVariable(String token, String environmentPath, String name, String value) {
        Map<String, Object> payload = Map.of("name", name, "value", value);
        String path = environmentPath + "/variables/" + name;
        try {
            github.get().uri(path).headers(h -> h.setBearerAuth(token)).retrieve().toBodilessEntity().block();
            github.patch().uri(path).headers(h -> h.setBearerAuth(token)).bodyValue(Map.of("value", value)).retrieve().toBodilessEntity().block();
        } catch (org.springframework.web.reactive.function.client.WebClientResponseException.NotFound missing) {
            github.post().uri(environmentPath + "/variables").headers(h -> h.setBearerAuth(token)).bodyValue(payload).retrieve().toBodilessEntity().block();
        }
    }

    private void ensureEnvironment(String token, String owner, String repo) {
        String path = "/repos/" + owner + "/" + repo + "/environments/" + ENVIRONMENT;
        try {
            github.get().uri(path).headers(h -> h.setBearerAuth(token)).retrieve().toBodilessEntity().block();
        } catch (org.springframework.web.reactive.function.client.WebClientResponseException.NotFound missing) {
            github.put().uri(path).headers(h -> h.setBearerAuth(token)).bodyValue(Map.of()).retrieve().toBodilessEntity().block();
        }
    }

    private static String string(Map<?, ?> source, String key) {
        Object value = source == null ? null : source.get(key);
        if (!(value instanceof String text) || text.isBlank()) throw new IllegalStateException("GITHUB_INVALID_ENVIRONMENT_KEY");
        return text;
    }
}
