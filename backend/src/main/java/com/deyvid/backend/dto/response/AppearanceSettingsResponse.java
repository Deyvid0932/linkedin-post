package com.deyvid.backend.dto.response;

import java.util.List;

public record AppearanceSettingsResponse(
        String userAccentColor,
        String defaultAccentColor,
        List<String> allowedAccentColors,
        boolean administrator
) {}
