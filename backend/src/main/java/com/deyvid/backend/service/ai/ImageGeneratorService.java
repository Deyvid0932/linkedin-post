package com.deyvid.backend.service.ai;

import com.deyvid.backend.service.linkedin.ContentSource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import java.util.List;

@Service
@Slf4j
public class ImageGeneratorService {

    public record ImageData(byte[] bytes, String imageUrl) {}

    @org.springframework.beans.factory.annotation.Value("${pexels.api-key:${PEXELS_API_KEY:}}")
    private String configuredPexelsApiKey;

    @org.springframework.beans.factory.annotation.Value("${replicate.api-key:${REPLICATE_API_KEY:}}")
    private String configuredReplicateApiKey;

    private final WebClient genericWebClient;

    // Colección de imágenes fotográficas limpias y profesionales de alta resolución sin dependencia de APIs externas
    private static final List<String> CURATED_TECH_IMAGES = List.of(
            "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&auto=format&fit=crop&q=80", // Código y terminal
            "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&auto=format&fit=crop&q=80", // Hardware y microchips
            "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=1200&auto=format&fit=crop&q=80", // Dashboard analítico y datos
            "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=80"  // Red distribuida y cloud
    );

    public ImageGeneratorService(@Qualifier("genericWebClient") WebClient genericWebClient) {
        this.genericWebClient = genericWebClient;
    }

    private String getEffectiveReplicateApiKey() {
        if (configuredReplicateApiKey != null && !configuredReplicateApiKey.isBlank() && !configuredReplicateApiKey.contains("placeholder")) {
            return configuredReplicateApiKey.trim();
        }
        String sysProp = System.getProperty("REPLICATE_API_KEY");
        if (sysProp != null && !sysProp.isBlank()) {
            return sysProp.trim();
        }
        String envVal = System.getenv("REPLICATE_API_KEY");
        if (envVal != null && !envVal.isBlank()) {
            return envVal.trim();
        }
        return null;
    }

    private String getEffectivePexelsApiKey() {
        if (configuredPexelsApiKey != null && !configuredPexelsApiKey.isBlank() && !configuredPexelsApiKey.contains("placeholder")) {
            return configuredPexelsApiKey.trim();
        }
        String sysProp = System.getProperty("PEXELS_API_KEY");
        if (sysProp != null && !sysProp.isBlank()) {
            return sysProp.trim();
        }
        String envVal = System.getenv("PEXELS_API_KEY");
        if (envVal != null && !envVal.isBlank()) {
            return envVal.trim();
        }
        return null;
    }

    public ImageData generateAiImageWithReplicate(String topicTitle) {
        String apiKey = getEffectiveReplicateApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            return null;
        }

        String prompt = String.format(
                "A clean, modern 3D tech illustration about %s, sleek dark background, vibrant cyber blue and violet accents, cinematic lighting, 4k digital art, minimal aesthetic, no text",
                topicTitle != null ? topicTitle : "Software Engineering"
        );

        String endpoint = "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions";

        java.util.Map<String, Object> requestBody = java.util.Map.of(
                "input", java.util.Map.of(
                        "prompt", prompt,
                        "aspect_ratio", "16:9",
                        "output_format", "webp"
                )
        );

        try {
            log.info("🎨 Generando imagen con IA Replicate (FLUX Schnell) para: '{}'...", topicTitle);
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> response = genericWebClient.post()
                    .uri(endpoint)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Prefer", "wait=5")
                    .header("Content-Type", "application/json")
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(java.util.Map.class)
                    .timeout(java.time.Duration.ofSeconds(6))
                    .block();

            if (response != null && response.containsKey("output")) {
                Object outputObj = response.get("output");
                String outputUrl = null;
                if (outputObj instanceof List<?> list && !list.isEmpty()) {
                    outputUrl = String.valueOf(list.get(0));
                } else if (outputObj instanceof String str) {
                    outputUrl = str;
                }

                if (outputUrl != null && !outputUrl.isBlank()) {
                    byte[] downloaded = downloadImageBytes(outputUrl);
                    if (downloaded != null && downloaded.length > 1000) {
                        log.info("✅ Imagen de Replicate FLUX descargada exitosamente ({} bytes): {}", downloaded.length, outputUrl);
                        return new ImageData(downloaded, outputUrl);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Fallo o timeout al generar imagen con Replicate FLUX ({}). Continuando con Pexels.", e.getMessage());
        }

        return null;
    }

    /**
     * Mapea el tema técnico del post a los términos de búsqueda más precisos y relevantes en Pexels.
     */
    private String derivePexelsSearchQuery(String topicTitle) {
        if (topicTitle == null || topicTitle.isBlank()) {
            return "software engineering programming";
        }
        String lower = topicTitle.toLowerCase();

        if (lower.contains("frontend") || lower.contains("angular") || lower.contains("react") || lower.contains("signals") || lower.contains("rxjs") || lower.contains("javascript") || lower.contains("typescript") || lower.contains("css")) {
            return "web development programming computer";
        }
        if (lower.contains("database") || lower.contains("postgres") || lower.contains("sql") || lower.contains("b-tree") || lower.contains("mongo") || lower.contains("redis")) {
            return "database server data center";
        }
        if (lower.contains("java") || lower.contains("spring") || lower.contains("threads") || lower.contains("backend") || lower.contains("api") || lower.contains("microservicio")) {
            return "computer code programming technology";
        }
        if (lower.contains("cloud") || lower.contains("aws") || lower.contains("docker") || lower.contains("kubernetes") || lower.contains("devops") || lower.contains("azure")) {
            return "cloud computing server network";
        }
        if (lower.contains("ia") || lower.contains("ai") || lower.contains("inteligencia") || lower.contains("machine learning") || lower.contains("deepseek") || lower.contains("llm")) {
            return "artificial intelligence technology network";
        }
        if (lower.contains("arquitectura") || lower.contains("monolito") || lower.contains("clean code") || lower.contains("patrones") || lower.contains("software")) {
            return "software architecture programming technology";
        }

        // Limpiar caracteres especiales para búsqueda general
        String clean = topicTitle.replaceAll("[^a-zA-Z0-9 ]", " ").trim();
        return clean.length() > 3 ? clean + " technology" : "software programming technology";
    }

    public ImageData searchAndFetchPexelsPhoto(String topicTitle) {
        String apiKey = getEffectivePexelsApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            return null;
        }

        String query = derivePexelsSearchQuery(topicTitle);
        String url = "https://api.pexels.com/v1/search?query=" + java.net.URLEncoder.encode(query, java.nio.charset.StandardCharsets.UTF_8) + "&per_page=1&orientation=landscape";

        try {
            log.info("🔍 Buscando foto relevante en Pexels para '{}' con query: '{}'...", topicTitle, query);
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> response = genericWebClient.get()
                    .uri(url)
                    .header("Authorization", apiKey)
                    .retrieve()
                    .bodyToMono(java.util.Map.class)
                    .timeout(java.time.Duration.ofSeconds(3))
                    .block();

            if (response != null && response.containsKey("photos")) {
                @SuppressWarnings("unchecked")
                List<java.util.Map<String, Object>> photos = (List<java.util.Map<String, Object>>) response.get("photos");
                if (!photos.isEmpty()) {
                    @SuppressWarnings("unchecked")
                    java.util.Map<String, Object> photo = photos.get(0);
                    @SuppressWarnings("unchecked")
                    java.util.Map<String, String> src = (java.util.Map<String, String>) photo.get("src");
                    if (src != null) {
                        String photoUrl = src.getOrDefault("landscape", src.getOrDefault("large", src.get("original")));
                        if (photoUrl != null && !photoUrl.isBlank()) {
                            byte[] downloaded = downloadImageBytes(photoUrl);
                            if (downloaded != null && downloaded.length > 1000) {
                                log.info("✅ Foto de Pexels descargada exitosamente ({} bytes): {}", downloaded.length, photoUrl);
                                return new ImageData(downloaded, photoUrl);
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Error buscando foto en Pexels ({}). Usando generador visual de respaldo.", e.getMessage());
        }

        return null;
    }

    /**
     * Obtiene una imagen generada con IA (Replicate FLUX Schnell), una foto relevante desde Pexels API,
     * un banner técnico moderno con Graphics2D o una foto curada de stock.
     */
    public ImageData generateOrFetchImage(ContentSource source, String postText) {
        String topicTitle = (source != null && source.title() != null && !source.title().isBlank())
                ? source.title()
                : "Technology and Software Engineering";

        // 1. Intentar generar ilustración con IA Replicate (FLUX Schnell)
        ImageData replicateData = generateAiImageWithReplicate(topicTitle);
        if (replicateData != null && replicateData.bytes() != null && replicateData.bytes().length > 1000) {
            return replicateData;
        }

        // 2. Buscar fotografía temática relevante en Pexels API
        ImageData pexelsData = searchAndFetchPexelsPhoto(topicTitle);
        if (pexelsData != null && pexelsData.bytes() != null && pexelsData.bytes().length > 1000) {
            return pexelsData;
        }

        int hash = Math.abs(topicTitle.hashCode());

        // 3. Generar banner visual técnico con Graphics2D (Título personalizado, degradado oscuro y badge)
        log.info("Generando banner visual profesional para '{}'", topicTitle);
        byte[] generatedBytes = generateModernBannerBytes(topicTitle, (hash % 5) + 1);
        if (generatedBytes != null && generatedBytes.length > 500) {
            String dataUrl = "data:image/png;base64," + java.util.Base64.getEncoder().encodeToString(generatedBytes);
            return new ImageData(generatedBytes, dataUrl);
        }

        // 4. Respaldo a fotografía curada de stock
        int imageIndex = hash % CURATED_TECH_IMAGES.size();
        String selectedImageUrl = CURATED_TECH_IMAGES.get(imageIndex);
        byte[] downloadedBytes = downloadImageBytes(selectedImageUrl);
        if (downloadedBytes != null && downloadedBytes.length > 1000) {
            log.info("Imagen de stock seleccionada para '{}': {}", topicTitle, selectedImageUrl);
            return new ImageData(downloadedBytes, selectedImageUrl);
        }

        return new ImageData(createFallbackPngBytes(), null);
    }

    public byte[] generateOrFetchImage(String topicKeyword) {
        String baseKeyword = (topicKeyword != null && !topicKeyword.isBlank()) ? topicKeyword : "data technology";
        ImageData data = generateOrFetchImage(null, baseKeyword);
        return data.bytes() != null ? data.bytes() : createFallbackPngBytes();
    }

    public byte[] fetchBytesFromUrl(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) return createFallbackPngBytes();

        // Soporte para imágenes en formato base64 / Data URL
        if (imageUrl.startsWith("data:image/") || imageUrl.startsWith("data:application/octet-stream;base64,") || imageUrl.contains(";base64,")) {
            try {
                int commaIndex = imageUrl.indexOf(",");
                if (commaIndex != -1) {
                    String base64Data = imageUrl.substring(commaIndex + 1).replaceAll("\\s+", "");
                    return java.util.Base64.getMimeDecoder().decode(base64Data);
                }
            } catch (Exception e) {
                log.warn("Error decodificando imagen base64: {}. Usando fallback.", e.getMessage());
                return createFallbackPngBytes();
            }
        }

        try {
            byte[] downloaded = genericWebClient.get()
                    .uri(imageUrl)
                    .retrieve()
                    .bodyToMono(byte[].class)
                    .block();
            return (downloaded != null && downloaded.length > 100) ? downloaded : createFallbackPngBytes();
        } catch (Exception e) {
            log.warn("Error descargando imagen desde URL {}: {}. Usando banner local.", imageUrl, e.getMessage());
            return generateModernBannerBytes("Post Técnico", 1);
        }
    }

    private byte[] generateModernBannerBytes(String topicTitle, int colorVariant) {
        try {
            int width = 1200;
            int height = 630;
            java.awt.image.BufferedImage img = new java.awt.image.BufferedImage(width, height, java.awt.image.BufferedImage.TYPE_INT_RGB);
            java.awt.Graphics2D g = img.createGraphics();
            g.setRenderingHint(java.awt.RenderingHints.KEY_ANTIALIASING, java.awt.RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(java.awt.RenderingHints.KEY_TEXT_ANTIALIASING, java.awt.RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

            java.awt.Color darkBg = new java.awt.Color(15, 23, 42);
            java.awt.Color accentColor;
            java.awt.Color glowColor;

            switch (colorVariant) {
                case 1 -> {
                    accentColor = new java.awt.Color(99, 102, 241);
                    glowColor = new java.awt.Color(79, 70, 229, 90);
                }
                case 2 -> {
                    accentColor = new java.awt.Color(14, 165, 233);
                    glowColor = new java.awt.Color(2, 132, 199, 90);
                }
                case 3 -> {
                    accentColor = new java.awt.Color(16, 185, 129);
                    glowColor = new java.awt.Color(5, 150, 105, 90);
                }
                case 4 -> {
                    accentColor = new java.awt.Color(168, 85, 247);
                    glowColor = new java.awt.Color(147, 51, 234, 90);
                }
                default -> {
                    accentColor = new java.awt.Color(245, 158, 11);
                    glowColor = new java.awt.Color(217, 119, 6, 90);
                }
            }

            java.awt.GradientPaint bgGradient = new java.awt.GradientPaint(0, 0, darkBg, width, height, new java.awt.Color(30, 41, 59));
            g.setPaint(bgGradient);
            g.fillRect(0, 0, width, height);

            g.setColor(glowColor);
            g.fillOval(width - 400, -100, 500, 500);
            g.fillOval(-150, height - 350, 450, 450);

            g.setColor(new java.awt.Color(30, 41, 59, 220));
            g.fillRoundRect(80, 80, width - 160, height - 160, 28, 28);
            g.setColor(new java.awt.Color(71, 85, 105, 150));
            g.drawRoundRect(80, 80, width - 160, height - 160, 28, 28);

            g.setColor(accentColor);
            g.fillRoundRect(120, 130, 360, 40, 16, 16);
            g.setColor(java.awt.Color.WHITE);
            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.BOLD, 15));
            g.drawString("⚡ ARQUITECTURA & DESARROLLO", 140, 156);

            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.BOLD, 36));
            g.setColor(java.awt.Color.WHITE);
            String displayTitle = topicTitle != null ? topicTitle : "Guía Técnica de Ingeniería";
            if (displayTitle.length() > 65) {
                displayTitle = displayTitle.substring(0, 62) + "...";
            }
            g.drawString(displayTitle, 120, 250);

            g.setColor(accentColor);
            g.fillRect(120, 290, 140, 6);

            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 22));
            g.setColor(new java.awt.Color(203, 213, 225));
            g.drawString("• Buenas Prácticas  • Rendimiento  • Patrones de Diseño", 120, 340);

            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.BOLD, 18));
            g.setColor(new java.awt.Color(148, 163, 184));
            g.drawString("🚀 Deyvid Chupillon  |  LinkedIn Tech Series", 120, 480);

            g.dispose();

            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(img, "PNG", baos);
            return baos.toByteArray();
        } catch (Exception e) {
            log.error("Error renderizando banner local: {}", e.getMessage());
            return createFallbackPngBytes();
        }
    }

    private byte[] downloadImageBytes(String imageUrl) {
        try {
            return genericWebClient.get()
                    .uri(imageUrl)
                    .retrieve()
                    .bodyToMono(byte[].class)
                    .timeout(java.time.Duration.ofSeconds(3))
                    .block();
        } catch (Exception e) {
            log.warn("No se pudieron descargar bytes desde {}: {}. Usando banner local.", imageUrl, e.getMessage());
            return null;
        }
    }

    private byte[] createFallbackPngBytes() {
        return new byte[]{
                (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
                0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
                0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
                0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, (byte) 0xC4, (byte) 0xC9,
                0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41, 0x54,
                0x78, (byte) 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01,
                0x0D, 0x0A, 0x2D, (byte) 0xB4,
                0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
                (byte) 0xAE, 0x42, 0x60, (byte) 0x82
        };
    }
}
