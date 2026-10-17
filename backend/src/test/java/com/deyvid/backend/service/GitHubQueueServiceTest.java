package com.deyvid.backend.service;

import com.deyvid.backend.dto.request.QueueUploadRequest;
import com.deyvid.backend.entity.*;
import com.deyvid.backend.entity.enums.*;
import com.deyvid.backend.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.http.*;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.*;
import reactor.core.publisher.Mono;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GitHubQueueServiceTest {
    TenantRepository tenants = mock(TenantRepository.class);
    GitHubRepositoryRepo repos = mock(GitHubRepositoryRepo.class);
    GitHubCredentialRepository credentials = mock(GitHubCredentialRepository.class);
    LinkedInCredentialRepository accounts = mock(LinkedInCredentialRepository.class);
    DraftPreviewRepository drafts = mock(DraftPreviewRepository.class);
    GitHubLinkedInBindingRepository bindings = mock(GitHubLinkedInBindingRepository.class);
    PublicationAttemptService attempts = mock(PublicationAttemptService.class);
    EncryptionService encryption = mock(EncryptionService.class);
    Tenant tenant = Tenant.builder().id(UUID.randomUUID()).build();
    GitHubRepository repo = GitHubRepository.builder().id(UUID.randomUUID()).tenant(tenant).repoOwner("owner").repoName("queue").build();
    LinkedInCredential account = LinkedInCredential.builder().id(UUID.randomUUID()).tenant(tenant).accountType(LinkedInAccountType.PERSON).authorUrn("urn:li:person:test").isEnabled(true).build();
    GitHubLinkedInBinding binding = GitHubLinkedInBinding.builder().id(UUID.randomUUID()).tenant(tenant).repository(repo).linkedInCredential(account).syncStatus("SYNCED").build();
    DraftPreview draft = DraftPreview.builder().id(UUID.randomUUID()).tenant(tenant).isQueued(true).targetCredentialId(account.getId()).generatedText("Reviewed post").sourceMode(SourceMode.BACKUP).build();
    AtomicInteger calls = new AtomicInteger();
    List<ClientRequest> requests = new ArrayList<>();
    GitHubQueueService service;
    @BeforeEach void setup() {
        WebClient client = WebClient.builder().baseUrl("https://api.github.com").exchangeFunction(request -> {
            calls.incrementAndGet(); requests.add(request);
            String path = request.url().getPath();
            String response = switch (path) {
                case "/repos/owner/queue" -> "{\"default_branch\":\"main\"}";
                case "/repos/owner/queue/git/ref/heads/main" -> "{\"object\":{\"sha\":\"head-sha\"}}";
                case "/repos/owner/queue/git/commits/head-sha" -> "{\"tree\":{\"sha\":\"root-tree\"}}";
                case "/repos/owner/queue/git/blobs" -> "{\"sha\":\"blob-sha\"}";
                case "/repos/owner/queue/git/trees" -> "{\"sha\":\"tree-sha\"}";
                case "/repos/owner/queue/git/commits" -> "{\"sha\":\"commit-sha\"}";
                case "/repos/owner/queue/git/refs/heads/main" -> "{}";
                default -> "{}";
            };
            return Mono.just(ClientResponse.create(HttpStatus.OK).header("Content-Type", "application/json").body(response).build());
        }).build();
        service = new GitHubQueueService(tenants, repos, credentials, accounts, drafts, bindings, attempts, encryption, new SafeImageService(), client);
        ReflectionTestUtils.setField(service, "mode", "manual");
        when(tenants.findByIdForUpdate(tenant.getId())).thenReturn(Optional.of(tenant));
        when(repos.findById(repo.getId())).thenReturn(Optional.of(repo));
        when(accounts.findById(account.getId())).thenReturn(Optional.of(account));
        when(bindings.findByTenantIdAndRepositoryId(tenant.getId(), repo.getId())).thenReturn(Optional.of(binding));
        when(drafts.findOwnedForUpdate(draft.getId(), tenant.getId())).thenReturn(Optional.of(draft));
        when(credentials.findByTenantId(tenant.getId())).thenReturn(Optional.of(GitHubCredential.builder().personalAccessTokenEnc("encrypted").build()));
        when(encryption.decrypt("encrypted")).thenReturn("test-token");
    }
    QueueUploadRequest request() { return new QueueUploadRequest(repo.getId(), account.getId(), OffsetDateTime.now().plusDays(1), "America/Lima", List.of(draft.getId())); }
    @Test void uploadsOnlyFixedQueuePathAndDoesNotPublishOrConsumeDraft() {
        var result = service.upload(tenant.getId(), request());
        assertEquals(1, result.postCount()); assertEquals("main", result.branch());
        assertEquals(7, calls.get()); assertEquals(HttpMethod.PATCH, requests.get(6).method());
        assertEquals("/repos/owner/queue/git/refs/heads/main", requests.get(6).url().getPath());
        verify(drafts, never()).delete(any()); verify(attempts, never()).claim(any(), any(), any(), anyString());
    }
    @Test void anotherTenantsRepoIsRejectedBeforeAnyNetworkAccess() {
        repo.setTenant(Tenant.builder().id(UUID.randomUUID()).build());
        assertThrows(IllegalArgumentException.class, () -> service.upload(tenant.getId(), request()));
        assertEquals(0, calls.get()); verifyNoInteractions(credentials, encryption);
    }
    @Test void unapprovedOrAlreadyAttemptedPostCannotBeUploaded() {
        draft.setQueued(false);
        assertThrows(IllegalArgumentException.class, () -> service.upload(tenant.getId(), request()));
        draft.setQueued(true); when(attempts.hasAttempts(draft.getId())).thenReturn(true);
        assertThrows(IllegalArgumentException.class, () -> service.upload(tenant.getId(), request()));
        assertEquals(0, calls.get());
    }
    @Test void queueMustUseThePersonalAccountAlreadyBoundAndSyncedToTheRepository() {
        when(bindings.findByTenantIdAndRepositoryId(tenant.getId(), repo.getId())).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class, () -> service.upload(tenant.getId(), request()));
        when(bindings.findByTenantIdAndRepositoryId(tenant.getId(), repo.getId())).thenReturn(Optional.of(
                GitHubLinkedInBinding.builder().tenant(tenant).repository(repo).linkedInCredential(account).syncStatus("PENDING").build()));
        assertThrows(IllegalArgumentException.class, () -> service.upload(tenant.getId(), request()));
        assertEquals(0, calls.get());
    }
    @Test void scheduleRejectsInvalidTimezoneBeforeGitHubAccess() {
        assertThrows(IllegalArgumentException.class, () -> service.schedule(tenant.getId(), repo.getId(), UUID.randomUUID(),
                OffsetDateTime.now().plusDays(2).toString(), "Not/A_Timezone", "head-sha"));
        assertEquals(0, calls.get());
    }
    @Test void scheduleRejectsAStaleRepositoryRevisionBeforeReadingOrWritingQueue() {
        var error = assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> service.schedule(
                tenant.getId(), repo.getId(), UUID.randomUUID(), OffsetDateTime.now().plusDays(2).toString(), "America/Lima", "old-head"));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        assertEquals(2, calls.get());
    }
    @Test void aDifferentDestinationOrActiveBackendSchedulerIsRejected() {
        draft.setTargetCredentialId(UUID.randomUUID());
        assertThrows(IllegalArgumentException.class, () -> service.upload(tenant.getId(), request()));
        draft.setTargetCredentialId(account.getId()); ReflectionTestUtils.setField(service, "mode", "actions");
        assertThrows(IllegalArgumentException.class, () -> service.upload(tenant.getId(), request()));
        assertEquals(0, calls.get());
    }
}
