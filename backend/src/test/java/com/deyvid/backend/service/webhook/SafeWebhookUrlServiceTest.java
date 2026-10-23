package com.deyvid.backend.service.webhook;

import org.junit.jupiter.api.Test;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class SafeWebhookUrlServiceTest {
    private final SafeWebhookUrlService service = new SafeWebhookUrlService();

    @Test
    void acceptsOnlyHttpsDomainsWithoutCredentialsOrCustomPorts() {
        assertEquals("https", service.validateSyntax("https://hooks.example.com/autopost").getScheme());
        assertThrows(IllegalArgumentException.class, () -> service.validateSyntax("http://hooks.example.com/hook"));
        assertThrows(IllegalArgumentException.class, () -> service.validateSyntax("https://user:pass@example.com/hook"));
        assertThrows(IllegalArgumentException.class, () -> service.validateSyntax("https://example.com:8443/hook"));
    }

    @Test
    void rejectsLocalAndIpLiteralTargets() {
        assertThrows(IllegalArgumentException.class, () -> service.validateSyntax("https://localhost/hook"));
        assertThrows(IllegalArgumentException.class, () -> service.validateSyntax("https://hooks.local/hook"));
        assertThrows(IllegalArgumentException.class, () -> service.validateSyntax("https://127.0.0.1/hook"));
        assertThrows(IllegalArgumentException.class, () -> service.validateSyntax("https://[::1]/hook"));
    }

    @Test
    void returnsTheExactPublicAddressesValidatedForTheConnection() throws Exception {
        InetAddress pinned = InetAddress.getByName("8.8.8.8");
        AtomicInteger lookups = new AtomicInteger();
        SafeWebhookUrlService resolvingService = new SafeWebhookUrlService(host -> {
            lookups.incrementAndGet();
            assertEquals("hooks.example.com", host);
            return new InetAddress[]{pinned};
        });

        SafeWebhookUrlService.ValidatedDestination destination =
                resolvingService.resolvePublicDestination("https://hooks.example.com/events");
        var resolver = WebhookDeliveryService.pinnedDnsResolver(destination);

        assertArrayEquals(new InetAddress[]{pinned}, resolver.resolve("hooks.example.com"));
        assertEquals("hooks.example.com", resolver.resolveCanonicalHostname("hooks.example.com"));
        assertEquals(1, lookups.get(), "The connection must reuse the address set checked for public IPs");
        assertThrows(UnknownHostException.class, () -> resolver.resolve("metadata.internal"));
    }

    @Test
    void rejectsAHostnameThatResolvesToAnyPrivateAddress() throws Exception {
        InetAddress publicAddress = InetAddress.getByName("8.8.8.8");
        InetAddress privateAddress = InetAddress.getByName("10.0.0.7");
        SafeWebhookUrlService resolvingService = new SafeWebhookUrlService(
                host -> new InetAddress[]{publicAddress, privateAddress});

        assertThrows(IllegalArgumentException.class,
                () -> resolvingService.resolvePublicDestination("https://hooks.example.com/events"));
    }

    @Test
    void rejectsIpv6TranslationAndTunnelRangesThatCanBypassIpv4Checks() throws Exception {
        InetAddress nat64 = InetAddress.getByAddress(new byte[]{
                0x00, 0x64, (byte) 0xff, (byte) 0x9b, 0, 0, 0, 0,
                0, 0, 0, 0, (byte) 0xa9, (byte) 0xfe, (byte) 0xa9, (byte) 0xfe
        });
        InetAddress sixToFour = InetAddress.getByAddress(new byte[]{
                0x20, 0x02, 0x0a, 0x00, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 1
        });
        InetAddress teredo = InetAddress.getByAddress(new byte[]{
                0x20, 0x01, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 1
        });
        InetAddress documentation = InetAddress.getByAddress(new byte[]{
                0x20, 0x01, 0x0d, (byte) 0xb8, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 1
        });

        for (InetAddress address : new InetAddress[]{nat64, sixToFour, teredo, documentation}) {
            SafeWebhookUrlService resolvingService = new SafeWebhookUrlService(host -> new InetAddress[]{address});
            assertThrows(IllegalArgumentException.class,
                    () -> resolvingService.resolvePublicDestination("https://hooks.example.com/events"));
        }
    }

    @Test
    void rejectsDeprecatedIpv4SixToFourRelayRange() throws Exception {
        InetAddress relayAnycast = InetAddress.getByAddress(new byte[]{(byte) 192, (byte) 88, 99, 1});
        SafeWebhookUrlService resolvingService = new SafeWebhookUrlService(host -> new InetAddress[]{relayAnycast});

        assertThrows(IllegalArgumentException.class,
                () -> resolvingService.resolvePublicDestination("https://hooks.example.com/events"));
    }

    @Test
    void acceptsGlobalUnicastIpv6Destinations() throws Exception {
        InetAddress publicAddress = InetAddress.getByAddress(new byte[]{
                0x26, 0x06, 0x47, 0x00, 0x47, 0x00, 0, 0,
                0, 0, 0, 0, 0, 0, 0x11, 0x11
        });
        SafeWebhookUrlService resolvingService = new SafeWebhookUrlService(host -> new InetAddress[]{publicAddress});

        assertEquals(publicAddress,
                resolvingService.resolvePublicDestination("https://hooks.example.com/events").addresses().get(0));
    }
}
