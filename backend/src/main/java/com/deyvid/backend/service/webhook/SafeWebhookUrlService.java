package com.deyvid.backend.service.webhook;

import org.springframework.stereotype.Service;

import java.net.IDN;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

@Service
public class SafeWebhookUrlService {
    @FunctionalInterface
    interface DnsLookup {
        InetAddress[] resolve(String host) throws UnknownHostException;
    }

    public record ValidatedDestination(URI uri, List<InetAddress> addresses) {
        public ValidatedDestination {
            addresses = List.copyOf(addresses);
        }
    }

    private final DnsLookup dnsLookup;

    public SafeWebhookUrlService() {
        this(InetAddress::getAllByName);
    }

    SafeWebhookUrlService(DnsLookup dnsLookup) {
        this.dnsLookup = dnsLookup;
    }

    public URI validateSyntax(String rawUrl) {
        try {
            URI uri = URI.create(rawUrl == null ? "" : rawUrl.trim()).normalize();
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(scheme) || host == null || uri.getUserInfo() != null
                    || uri.getFragment() != null || (uri.getPort() != -1 && uri.getPort() != 443)) {
                throw new IllegalArgumentException("Usa una URL HTTPS pública sin usuario, fragmento ni puerto personalizado");
            }
            String asciiHost = IDN.toASCII(host).toLowerCase(Locale.ROOT);
            if (!asciiHost.contains(".") || asciiHost.startsWith(".") || asciiHost.endsWith(".")
                    || asciiHost.contains("..") || isIpLiteral(host)
                    || Arrays.stream(new String[]{"localhost", ".local", ".internal", ".test", ".invalid"})
                        .anyMatch(suffix -> asciiHost.equals(suffix) || asciiHost.endsWith(suffix))) {
                throw new IllegalArgumentException("El destino debe ser un dominio público válido");
            }
            return new URI(uri.getScheme(), uri.getUserInfo(), asciiHost, uri.getPort(), uri.getPath(), uri.getQuery(), null);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("La URL del webhook no es válida");
        }
    }

    public URI validatePublicDestination(String rawUrl) {
        return resolvePublicDestination(rawUrl).uri();
    }

    public ValidatedDestination resolvePublicDestination(String rawUrl) {
        URI uri = validateSyntax(rawUrl);
        try {
            InetAddress[] addresses = dnsLookup.resolve(uri.getHost());
            if (addresses.length == 0 || Arrays.stream(addresses).anyMatch(this::isNonPublicAddress)) {
                throw new IllegalArgumentException("El destino del webhook resuelve a una dirección privada o reservada");
            }
            return new ValidatedDestination(uri, List.of(addresses));
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("No se pudo validar el dominio público del webhook");
        }
    }

    private boolean isIpLiteral(String host) {
        if (host.contains(":")) return true;
        return host.matches("[0-9.]+") && host.matches("(?:[0-9]{1,3}\\.){3}[0-9]{1,3}");
    }

    private boolean isNonPublicAddress(InetAddress address) {
        byte[] b = address.getAddress();
        if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isSiteLocalAddress()
                || address.isLinkLocalAddress() || address.isMulticastAddress()) return true;
        if (b.length == 4) return isNonPublicIpv4(b);
        if (isIpv4MappedIpv6(b)) return isNonPublicIpv4(Arrays.copyOfRange(b, 12, 16));

        // Only accept global-unicast IPv6. This also rejects NAT64, 6to4, Teredo,
        // unique-local and other transition/special-purpose ranges that can route
        // around checks which only look for RFC 1918 IPv4 or link-local IPv6.
        int first = b[0] & 0xff;
        if ((first & 0xe0) != 0x20) return true; // Not in 2000::/3 global unicast.

        // IANA special-purpose/documentation allocations inside 2000::/3.
        boolean inside2001ProtocolAssignments = first == 0x20 && (b[1] & 0xff) == 0x01
                && (b[2] & 0xfe) == 0; // 2001::/23, including Teredo/ORCHID.
        boolean documentation = first == 0x20 && (b[1] & 0xff) == 0x01
                && (b[2] & 0xff) == 0x0d && (b[3] & 0xff) == 0xb8; // 2001:db8::/32.
        boolean sixToFour = first == 0x20 && (b[1] & 0xff) == 0x02; // 2002::/16.
        boolean newerDocumentation = first == 0x3f && (b[1] & 0xff) == 0xff && (b[2] & 0xf0) == 0; // 3fff::/20.
        return inside2001ProtocolAssignments || documentation || sixToFour || newerDocumentation;
    }

    private boolean isNonPublicIpv4(byte[] b) {
        int a = b[0] & 0xff, second = b[1] & 0xff, third = b[2] & 0xff;
        return a == 0 || a == 10 || a == 127 || a >= 224 || (a == 100 && second >= 64 && second <= 127)
                || (a == 169 && second == 254) || (a == 172 && second >= 16 && second <= 31)
                || (a == 192 && (second == 0 || second == 168)) || (a == 198 && (second == 18 || second == 19 || second == 51))
                || (a == 192 && second == 88 && third == 99) // Deprecated 6to4 relay anycast.
                || (a == 203 && second == 0 && third == 113);
    }

    private boolean isIpv4MappedIpv6(byte[] address) {
        if (address.length != 16) return false;
        for (int i = 0; i < 10; i++) {
            if (address[i] != 0) return false;
        }
        return (address[10] & 0xff) == 0xff && (address[11] & 0xff) == 0xff;
    }
}
