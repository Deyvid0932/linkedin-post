package com.deyvid.backend.dto.response;

import java.time.LocalDate;

public record AdminDailyApiRequestCountResponse(
        LocalDate date,
        boolean tracked,
        long successful,
        long redirects,
        long clientErrors,
        long serverErrors
) {}
