package com.deyvid.backend.service.source;

import com.deyvid.backend.entity.GitHubCredential;
import com.deyvid.backend.entity.GitHubRepository;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.entity.enums.SourceMode;
import com.deyvid.backend.service.linkedin.ContentSource;
import com.deyvid.backend.repository.GitHubCredentialRepository;
import com.deyvid.backend.repository.GitHubRepositoryRepo;
import com.deyvid.backend.service.EncryptionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@Slf4j
public class GitHubSourceService {

    private final GitHubCredentialRepository gitHubCredentialRepository;
    private final GitHubRepositoryRepo gitHubRepositoryRepo;
    private final EncryptionService encryptionService;
    private final WebClient gitHubWebClient;

    public GitHubSourceService(
            GitHubCredentialRepository gitHubCredentialRepository,
            GitHubRepositoryRepo gitHubRepositoryRepo,
            EncryptionService encryptionService,
            @Qualifier("gitHubWebClient") WebClient gitHubWebClient) {
        this.gitHubCredentialRepository = gitHubCredentialRepository;
        this.gitHubRepositoryRepo = gitHubRepositoryRepo;
        this.encryptionService = encryptionService;
        this.gitHubWebClient = gitHubWebClient;
    }

    @Transactional
    public Optional<ContentSource> findRecentActivity(Tenant tenant) {
        log.info("Evaluando Prioridad 1 (MODO PROYECTO - GitHub) para tenant {}", tenant.getId());

        Optional<GitHubCredential> credOpt = gitHubCredentialRepository.findByTenantId(tenant.getId());
        if (credOpt.isEmpty() || !credOpt.get().getIsValid()) {
            log.info("No hay credenciales de GitHub válidas para el tenant {}", tenant.getId());
            return Optional.empty();
        }

        GitHubCredential cred = credOpt.get();
        String token = encryptionService.decrypt(cred.getPersonalAccessTokenEnc());

        List<GitHubRepository> repos = gitHubRepositoryRepo.findByTenantIdAndIsActiveTrue(tenant.getId());
        if (repos.isEmpty()) {
            log.info("No hay repositorios configurados para monitoreo en tenant {}", tenant.getId());
            return Optional.empty();
        }

        LocalDateTime sinceDate = LocalDateTime.now().minusDays(30);
        String sinceIso = sinceDate.format(DateTimeFormatter.ISO_DATE_TIME);

        for (GitHubRepository repo : repos) {
            try {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> commits = gitHubWebClient.get()
                        .uri(uriBuilder -> {
                            var builder = uriBuilder.path("/repos/{owner}/{repo}/commits").queryParam("per_page", 5);
                            if (repo.getLastCommitSha() != null) {
                                builder.queryParam("since", sinceIso);
                            }
                            return builder.build(repo.getRepoOwner(), repo.getRepoName());
                        })
                        .header("Authorization", "Bearer " + token)
                        .retrieve()
                        .bodyToMono(List.class)
                        .block();

                if (commits != null && !commits.isEmpty()) {
                    Map<String, Object> latestCommit = commits.get(0);
                    String sha = (String) latestCommit.get("sha");

                    if (sha != null && sha.equals(repo.getLastCommitSha())) {
                        continue;
                    }

                    @SuppressWarnings("unchecked")
                    Map<String, Object> commitInfo = (Map<String, Object>) latestCommit.get("commit");
                    String commitMessage = (String) commitInfo.get("message");

                    repo.setLastCheckedAt(LocalDateTime.now());
                    repo.setLastCommitSha(sha);
                    gitHubRepositoryRepo.save(repo);

                    log.info("Commit reciente encontrado en {}/{}: {}", repo.getRepoOwner(), repo.getRepoName(), commitMessage);

                    return Optional.of(new ContentSource(
                            SourceMode.PROJECT,
                            "Actualización en " + repo.getRepoName() + ": " + commitMessage,
                            "Se implementó la siguiente mejora/funcionalidad en el repositorio " + repo.getRepoName() + ": " + commitMessage,
                            null,
                            "https://github.com/" + repo.getRepoOwner() + "/" + repo.getRepoName() + "/commit/" + sha
                    ));
                }
            } catch (Exception e) {
                log.warn("Error al consultar commits del repositorio {}/{}: {}", repo.getRepoOwner(), repo.getRepoName(), e.getMessage());
            }
        }

        log.info("No se encontraron commits recientes en GitHub para tenant {}", tenant.getId());
        return Optional.empty();
    }
}
