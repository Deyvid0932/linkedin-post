package com.deyvid.backend.service;

import com.deyvid.backend.dto.request.ApiQuotaPolicyRequest;
import com.deyvid.backend.entity.PlatformApiQuotaSettings;
import com.deyvid.backend.repository.PlatformApiQuotaSettingsRepository;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ApiQuotaPolicyServiceTest {
    private final ApiQuotaPolicyService service = new ApiQuotaPolicyService(null);

    @Test
    void validatesLimitsBeforePersisting() {
        assertThrows(IllegalArgumentException.class, () -> service.validate(new ApiQuotaPolicyRequest(0, 10, 120)));
        assertThrows(IllegalArgumentException.class, () -> service.validate(new ApiQuotaPolicyRequest(20, 121, 120)));
        assertThrows(IllegalArgumentException.class, () -> service.validate(new ApiQuotaPolicyRequest(20, 10, 601)));
    }

    @Test
    void policyResolvesLimitByRequestGroup() {
        var policy = new ApiQuotaPolicyService.RatePolicy(20, 7, 150);
        assertEquals(20, policy.limitFor("auth"));
        assertEquals(7, policy.limitFor("ai"));
        assertEquals(150, policy.limitFor("api"));
    }

    @Test
    void reloadsGlobalPolicySoEveryApplicationInstanceUsesAdminChanges() {
        PlatformApiQuotaSettings settings = settings(20, 10, 120);
        PlatformApiQuotaSettingsRepository repository = (PlatformApiQuotaSettingsRepository) Proxy.newProxyInstance(
                PlatformApiQuotaSettingsRepository.class.getClassLoader(),
                new Class<?>[] { PlatformApiQuotaSettingsRepository.class },
                (proxy, method, args) -> {
                    if (method.getName().equals("findById")) return Optional.of(settings);
                    if (method.getName().equals("toString")) return "Quota settings repository";
                    if (method.getName().equals("hashCode")) return System.identityHashCode(proxy);
                    if (method.getName().equals("equals")) return proxy == args[0];
                    throw new UnsupportedOperationException(method.getName());
                });
        ApiQuotaPolicyService service = new ApiQuotaPolicyService(repository);

        assertEquals(120, service.currentPolicy().limitFor("api"));
        settings.setApiRequestsPerMinute(35);
        assertEquals(35, service.currentPolicy().limitFor("api"));
    }

    private static PlatformApiQuotaSettings settings(int auth, int ai, int api) {
        PlatformApiQuotaSettings settings = new PlatformApiQuotaSettings();
        settings.setId((short) 1);
        settings.setAuthRequestsPerMinute(auth);
        settings.setAiRequestsPerMinute(ai);
        settings.setApiRequestsPerMinute(api);
        return settings;
    }
}
