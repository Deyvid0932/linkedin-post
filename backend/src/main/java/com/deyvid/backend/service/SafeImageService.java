package com.deyvid.backend.service;

import org.springframework.stereotype.Service;
import java.net.URI;
import java.util.Base64;
import java.util.Set;

/** Uploaded raster images or fixed stock CDNs only; never fetch arbitrary user URLs. */
@Service
public class SafeImageService {
    public static final int MAX_BYTES = 5 * 1024 * 1024;
    private static final Set<String> HOSTS = Set.of("images.unsplash.com", "images.pexels.com", "replicate.delivery");

    public void validate(String value) {
        if (value == null || value.isBlank()) return;
        if (value.startsWith("data:")) { decode(value); return; }
        try {
            URI uri = URI.create(value);
            String host = uri.getHost();
            if (!"https".equals(uri.getScheme()) || host == null || !HOSTS.contains(host)
                    || uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443)) {
                throw new IllegalArgumentException();
            }
        } catch (Exception e) {
            throw new IllegalArgumentException("Sube una imagen PNG o JPEG. La URL de imagen no está permitida.");
        }
    }

    public byte[] decode(String value) {
        if (value == null || value.length() > MAX_BYTES * 4 / 3 + 128) {
            throw new IllegalArgumentException("La imagen supera el límite de 5 MB");
        }
        int comma = value.indexOf(',');
        if (comma < 0) throw new IllegalArgumentException("Imagen inválida");
        String prefix = value.substring(0, comma);
        if (!Set.of("data:image/png;base64", "data:image/jpeg;base64").contains(prefix)) {
            throw new IllegalArgumentException("Solo se permiten PNG y JPEG para publicar en LinkedIn");
        }
        byte[] bytes;
        try { bytes = Base64.getDecoder().decode(value.substring(comma + 1)); }
        catch (IllegalArgumentException e) { throw new IllegalArgumentException("Imagen base64 inválida"); }
        String mime = validateBytes(bytes);
        if (!prefix.equals("data:" + mime + ";base64")) throw new IllegalArgumentException("El contenido no coincide con el formato de imagen");
        return bytes;
    }

    public String validateBytes(byte[] bytes) {
        if (bytes == null) throw new IllegalArgumentException("Imagen vacía");
        if (bytes.length > MAX_BYTES || bytes.length < 12) throw new IllegalArgumentException("Imagen inválida o mayor de 5 MB");
        boolean png = bytes[0] == (byte) 0x89 && bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G'
                && bytes[4] == 13 && bytes[5] == 10 && bytes[6] == 26 && bytes[7] == 10;
        boolean jpeg = bytes[0] == (byte) 0xff && bytes[1] == (byte) 0xd8 && bytes[2] == (byte) 0xff;
        if (!png && !jpeg) throw new IllegalArgumentException("Solo se permiten imágenes PNG y JPEG");
        try (var input = javax.imageio.ImageIO.createImageInputStream(new java.io.ByteArrayInputStream(bytes))) {
            var readers = javax.imageio.ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw new IllegalArgumentException("Imagen no reconocida");
            var reader = readers.next();
            try {
                reader.setInput(input, true, true);
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (width <= 0 || height <= 0 || (long) width * height >= 36152320L) throw new IllegalArgumentException("La imagen supera el límite de píxeles de LinkedIn");
            } finally { reader.dispose(); }
        } catch (java.io.IOException e) { throw new IllegalArgumentException("Imagen dañada o inválida"); }
        return png ? "image/png" : "image/jpeg";
    }
}
