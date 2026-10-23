package com.deyvid.backend.controller;

import com.deyvid.backend.dto.request.PromptTestRequest;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.repository.LinkedInCredentialRepository;
import com.deyvid.backend.repository.PublicationLogRepository;
import com.deyvid.backend.repository.PublishingScheduleRepository;
import com.deyvid.backend.repository.TenantRepository;
import com.deyvid.backend.security.AuthHelper;
import com.deyvid.backend.service.ComposeService;
import com.deyvid.backend.service.PlatformPublicationPolicyService;
import com.deyvid.backend.service.TenantService;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.ArgumentCaptor;

class TenantControllerPromptTest {

    @Test
    void promptTestUsesTheWorkspaceTextAndImageModels() {
        AuthHelper authHelper = mock(AuthHelper.class);
        Tenant tenant = Tenant.builder()
                .id(UUID.randomUUID())
                .timezone("America/Bogota")
                .appTargetCharacters(850)
                .appImageModel("qwen-image-2.1/text-to-image")
                .appTextModel("deepseek-v4-pro")
                .build();
        User user = User.builder().tenant(tenant).email("writer@example.test").build();
        Authentication authentication = mock(Authentication.class);
        when(authHelper.getCurrentUser(authentication)).thenReturn(user);

        ComposeService composeService = mock(ComposeService.class);
        when(composeService.generate(any(Tenant.class), any()))
                .thenReturn(new ComposeService.Proposal("Ejemplo listo.", "prompt de prueba"));

        TenantController controller = new TenantController(
                authHelper,
                mock(TenantRepository.class),
                mock(TenantService.class),
                mock(PublicationLogRepository.class),
                mock(PublishingScheduleRepository.class),
                mock(LinkedInCredentialRepository.class),
                composeService,
                mock(PlatformPublicationPolicyService.class));

        var response = controller.testPrompt(authentication,
                new PromptTestRequest("Instrucción de prueba", "tema de prueba", "EXPERT"));

        ArgumentCaptor<Tenant> effectiveTenant = ArgumentCaptor.forClass(Tenant.class);
        verify(composeService).generate(effectiveTenant.capture(), any());
        assertEquals(tenant.getId(), effectiveTenant.getValue().getId());
        assertEquals("America/Bogota", effectiveTenant.getValue().getTimezone());
        assertEquals(850, effectiveTenant.getValue().getAppTargetCharacters());
        assertEquals("qwen-image-2.1/text-to-image", effectiveTenant.getValue().getAppImageModel());
        assertEquals("deepseek-v4-pro", effectiveTenant.getValue().getAppTextModel());
        assertEquals("Instrucción de prueba", effectiveTenant.getValue().getSystemPrompt());
        assertEquals("Ejemplo listo.", response.getBody().get("generatedSample"));
    }
}
