package com.deyvid.backend.service;

import com.deyvid.backend.entity.PlatformPublicationPolicy;
import com.deyvid.backend.repository.PlatformPublicationPolicyRepository;
import org.junit.jupiter.api.Test;
import org.springframework.dao.TransientDataAccessResourceException;

import java.lang.reflect.Proxy;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PlatformPublicationPolicyServiceTest {
    @Test
    void globalApprovalPolicyOverridesTheTenantAutomaticMode() {
        PlatformPublicationPolicyService service = serviceWith(policy(true), null);

        PlatformPublicationPolicyService.Decision automatic = service.resolve("AUTOMATIC");
        PlatformPublicationPolicyService.Decision approval = service.resolve("REQUIRE_APPROVAL");

        assertTrue(automatic.approvalRequired());
        assertFalse(automatic.automaticPublicationAllowed());
        assertFalse(approval.automaticPublicationAllowed());
    }

    @Test
    void automaticPublishingCanResumeWhenTheGlobalApprovalRequirementIsOff() {
        PlatformPublicationPolicyService service = serviceWith(policy(false), null);

        assertTrue(service.resolve("AUTOMATIC").automaticPublicationAllowed());
        assertFalse(service.resolve("REQUIRE_APPROVAL").automaticPublicationAllowed());
    }

    @Test
    void failsClosedWhenTheGlobalPolicyCannotBeRead() {
        PlatformPublicationPolicyService service = serviceWith(null,
                new TransientDataAccessResourceException("database unavailable"));

        assertThrows(TransientDataAccessResourceException.class,
                () -> service.resolve("AUTOMATIC"));
    }

    private PlatformPublicationPolicy policy(boolean required) {
        return PlatformPublicationPolicy.builder().id((short) 1).approvalRequired(required)
                .updatedAt(LocalDateTime.now()).build();
    }

    private PlatformPublicationPolicyService serviceWith(PlatformPublicationPolicy policy, RuntimeException failure) {
        PlatformPublicationPolicyRepository repository = (PlatformPublicationPolicyRepository) Proxy.newProxyInstance(
                PlatformPublicationPolicyRepository.class.getClassLoader(),
                new Class<?>[]{PlatformPublicationPolicyRepository.class},
                (proxy, method, args) -> {
                    if (method.getName().equals("findById")) {
                        if (failure != null) throw failure;
                        return Optional.of(policy);
                    }
                    throw new UnsupportedOperationException("Unexpected repository method: " + method.getName());
                });
        return new PlatformPublicationPolicyService(repository);
    }
}
