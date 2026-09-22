package com.deyvid.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebClientConfig {

    @Value("${app.linkedin.api-base-url:https://api.linkedin.com}")
    private String linkedInApiBaseUrl;

    @Value("${app.linkedin.api-version:202607}")
    private String linkedInApiVersion;

    @Bean
    public WebClient.Builder webClientBuilder() {
        return WebClient.builder();
    }

    @Bean(name = "gitHubWebClient")
    public WebClient gitHubWebClient(WebClient.Builder builder) {
        return builder.clone()
                .baseUrl("https://api.github.com")
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("User-Agent", "SaaS-LinkedIn-Automation-Engine")
                .build();
    }

    @Bean(name = "linkedInWebClient")
    public WebClient linkedInWebClient(WebClient.Builder builder) {
        return builder.clone()
                .baseUrl(linkedInApiBaseUrl)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("LinkedIn-Version", linkedInApiVersion)
                .defaultHeader("Linkedin-Version", linkedInApiVersion)
                .defaultHeader("X-Restli-Protocol-Version", "2.0.0")
                .build();
    }

    @Bean(name = "genericWebClient")
    @Primary
    public WebClient genericWebClient(WebClient.Builder builder) {
        return builder.clone().build();
    }
}
