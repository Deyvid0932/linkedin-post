package com.deyvid.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebClientConfig {

    @Bean
    public WebClient gitHubWebClient(WebClient.Builder builder) {
        return builder
                .baseUrl("https://api.github.com")
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("User-Agent", "SaaS-LinkedIn-Automation-Engine")
                .build();
    }

    @Bean
    public WebClient linkedInWebClient(WebClient.Builder builder) {
        return builder
                .baseUrl("https://api.linkedin.com")
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("Linkedin-Version", "202608")
                .defaultHeader("X-Restli-Protocol-Version", "2.0.0")
                .build();
    }

    @Bean
    public WebClient genericWebClient(WebClient.Builder builder) {
        return builder.build();
    }
}
