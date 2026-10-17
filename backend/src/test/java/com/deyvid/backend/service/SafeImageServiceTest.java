package com.deyvid.backend.service;

import org.junit.jupiter.api.Test;
import java.util.Base64;
import static org.junit.jupiter.api.Assertions.*;

class SafeImageServiceTest {
    private final SafeImageService images = new SafeImageService();
    @Test void rejectsInternalAddressesSvgAndDisguisedUrls() {
        for (String value : new String[]{"http://127.0.0.1:8080", "https://169.254.169.254/metadata", "file:///etc/passwd",
                "https://images.unsplash.com.attacker.test/image", "https://user@images.unsplash.com/image", "data:image/svg+xml;base64,PHN2Zz4="}) {
            assertThrows(IllegalArgumentException.class, () -> images.validate(value));
        }
    }
    @Test void acceptsKnownCdnAndValidPngButRejectsMismatchedType() {
        assertDoesNotThrow(() -> images.validate("https://images.unsplash.com/photo?w=1200"));
        String png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGD4DwABBAEAHnOcQAAAAABJRU5ErkJggg==";
        assertTrue(images.decode(png).length > 12);
        assertThrows(IllegalArgumentException.class, () -> images.decode(png.replace("image/png", "image/jpeg")));
    }
    @Test void rejectsOversizedImagesBeforeDecoding() {
        assertThrows(IllegalArgumentException.class, () -> images.decode("data:image/png;base64," + "A".repeat(SafeImageService.MAX_BYTES * 4 / 3 + 129)));
    }
    @Test void rejectsArbitraryBase64Payloads() {
        assertThrows(IllegalArgumentException.class, () -> images.decode("data:image/png;base64," + Base64.getEncoder().encodeToString("invalid image contents".getBytes())));
    }
}
