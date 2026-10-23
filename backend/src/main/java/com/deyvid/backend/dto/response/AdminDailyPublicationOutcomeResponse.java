package com.deyvid.backend.dto.response;

import java.time.LocalDate;

public record AdminDailyPublicationOutcomeResponse(LocalDate date, long published, long failed) {}
