package com.deyvid.backend.dto.response;

import java.time.LocalDate;

public record AdminDailyHttp429CountResponse(
        LocalDate date,
        boolean tracked,
        long auth,
        long ai,
        long api
) {}
