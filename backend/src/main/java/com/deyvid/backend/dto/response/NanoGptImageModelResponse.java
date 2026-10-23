package com.deyvid.backend.dto.response;

import java.math.BigDecimal;

public record NanoGptImageModelResponse(String id, String name, BigDecimal estimatedPriceUsd) {}
