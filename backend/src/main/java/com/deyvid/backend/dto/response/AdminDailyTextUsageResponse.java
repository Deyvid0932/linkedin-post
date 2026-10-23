package com.deyvid.backend.dto.response;

import java.time.LocalDate;

public record AdminDailyTextUsageResponse(LocalDate date, boolean tracked, long tokens) {}
