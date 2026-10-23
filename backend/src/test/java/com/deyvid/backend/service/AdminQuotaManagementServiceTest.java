package com.deyvid.backend.service;

import com.deyvid.backend.dto.request.TenantAiQuotaRequest;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;

class AdminQuotaManagementServiceTest {
    @Test
    void rejectsAnExpiryWhenTheTenantInheritsTheGlobalLimit() {
        AdminQuotaManagementService service = new AdminQuotaManagementService(null, null, null);

        assertThrows(IllegalArgumentException.class, () -> service.updateTenantAiQuota(
                null, UUID.randomUUID(), new TenantAiQuotaRequest(null, Instant.now().plusSeconds(3600))));
    }

    @Test
    void rejectsQuotaValuesAboveTheAllowedRangeBeforeAccessingPersistence() {
        AdminQuotaManagementService service = new AdminQuotaManagementService(null, null, null);

        assertThrows(IllegalArgumentException.class, () -> service.updateTenantAiQuota(
                null, UUID.randomUUID(), new TenantAiQuotaRequest(121, null)));
    }
}
