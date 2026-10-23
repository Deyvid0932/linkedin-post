package com.deyvid.backend.controller;

import com.deyvid.backend.dto.response.DailyContentSuggestionResponse;
import com.deyvid.backend.security.AuthHelper;
import com.deyvid.backend.service.analytics.DailyContentSuggestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/insights")
@RequiredArgsConstructor
public class DailyContentSuggestionController {
    private final AuthHelper auth;
    private final DailyContentSuggestionService suggestions;

    @PostMapping("/daily-suggestion")
    public DailyContentSuggestionResponse generate(Authentication principal) {
        var user = auth.getCurrentUser(principal);
        return suggestions.generate(user.getTenant(), user.getEmail());
    }
}
