package com.deyvid.backend.service.ai;

import com.deyvid.backend.entity.Tenant;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class VectorStoreTenantIsolationTest {
    @Test void queriesWithTenantFilterAndNeverReturnsAnotherTenantsDocument() {
        var store = mock(VectorStore.class);
        var tenant = Tenant.builder().id(UUID.randomUUID()).build();
        when(store.similaritySearch(any(SearchRequest.class))).thenReturn(List.of(
                new Document("private other tenant", Map.of("tenantId", UUID.randomUUID().toString(), "puntajeUsuario", 1)),
                new Document("own example", Map.of("tenantId", tenant.getId().toString(), "puntajeUsuario", 1))));
        var result = new VectorStoreService(store).findTopLikedContexts(tenant, "software");
        assertEquals(List.of("own example"), result);
        var captor = ArgumentCaptor.forClass(SearchRequest.class);
        verify(store).similaritySearch(captor.capture());
        assertNotNull(captor.getValue().getFilterExpression());
    }
    @Test void doesNotPerformUnscopedSearchWhenTenantMissing() {
        var store = mock(VectorStore.class);
        assertTrue(new VectorStoreService(store).findTopLikedContexts(null, "software").isEmpty());
        verifyNoInteractions(store);
    }
}
