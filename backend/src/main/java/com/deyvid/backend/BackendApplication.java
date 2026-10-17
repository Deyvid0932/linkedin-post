package com.deyvid.backend;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.List;
import java.util.TimeZone;

@SpringBootApplication
@EnableScheduling
@EnableAsync
public class BackendApplication {

	private static final Logger log = LoggerFactory.getLogger(BackendApplication.class);

	@PostConstruct
	public void init() {
		TimeZone.setDefault(TimeZone.getTimeZone("America/Lima"));
	}

	public static void main(String[] args) {
		loadDotEnv();
		SpringApplication.run(BackendApplication.class, args);
	}

	private static void loadDotEnv() {
		String userDir = System.getProperty("user.dir");
		String[] possiblePaths = {
			".env",
			"backend/.env",
			"../.env",
			userDir + "/.env",
			userDir + "/backend/.env"
		};

		for (String pathStr : possiblePaths) {
			File envFile = new File(pathStr);
			if (envFile.exists() && envFile.isFile()) {
				try {
					List<String> lines = Files.readAllLines(envFile.toPath(), StandardCharsets.UTF_8);
					int loaded = 0;
					for (String line : lines) {
						String trimmed = line.trim();
						if (trimmed.isEmpty() || trimmed.startsWith("#")) {
							continue;
						}
						int eqIdx = trimmed.indexOf('=');
						if (eqIdx > 0) {
							String key = trimmed.substring(0, eqIdx).trim();
							// Host secrets and explicit JVM configuration take priority over local development files.
							if (System.getenv(key) != null || System.getProperty(key) != null) continue;
							String value = trimmed.substring(eqIdx + 1).trim();
							if (value.startsWith("\"") && value.endsWith("\"") && value.length() >= 2) {
								value = value.substring(1, value.length() - 1);
							} else if (value.startsWith("'") && value.endsWith("'") && value.length() >= 2) {
								value = value.substring(1, value.length() - 1);
							}
							
							System.setProperty(key, value);
							if ("DEEPSEEK_API_KEY".equals(key)) {
								System.setProperty("spring.ai.openai.api-key", value);
								System.setProperty("LLM_API_KEY", value);
								System.setProperty("app.llm.api-key", value);
							} else if ("LLM_BASE_URL".equals(key)) {
								System.setProperty("spring.ai.openai.base-url", value);
								System.setProperty("app.llm.base-url", value);
							} else if ("LLM_MODEL".equals(key)) {
								System.setProperty("spring.ai.openai.chat.options.model", value);
								System.setProperty("app.llm.model", value);
							}
							loaded++;
						}
					}
					log.info("✓ Archivo .env cargado exitosamente desde: {} ({} variables inyectadas)", envFile.getAbsolutePath(), loaded);
					return;
				} catch (Exception e) {
					log.warn("Error leyendo archivo .env en {}: {}", pathStr, e.getMessage());
				}
			}
		}
	}

}
