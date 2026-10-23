package com.deyvid.backend.dto.response;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public record AdminOverviewResponse(
        long totalUsers,
        long activeUsers,
        long totalWorkspaces,
        long publishedPosts,
        long failedPosts,
        int periodDays,
        LocalDate apiRequestMetricsStartedOn,
        long apiRequestsToday,
        long successfulApiRequestsToday,
        long redirectedApiRequestsToday,
        long clientErrorApiRequestsToday,
        long serverErrorApiRequestsToday,
        List<AdminDailyApiRequestCountResponse> dailyApiRequests,
        long recordedTokensInPeriod,
        LocalDate textMetricsStartedOn,
        long reportedTextRequestsInPeriod,
        long http429ResponsesInPeriod,
        LocalDate http429MetricsStartedOn,
        Map<String, Long> http429ResponsesByRouteGroupInPeriod,
        List<AdminDailyHttp429CountResponse> dailyHttp429Responses,
        List<AdminDailyTextUsageResponse> dailyReportedTextTokens,
        List<AdminModelTextUsageResponse> textUsageByModel,
        List<AdminDailyPublicationOutcomeResponse> dailyPublicationOutcomes,
        long successfulImageGenerationsInPeriod,
        LocalDate imageMetricsStartedOn,
        List<AdminDailyImageGenerationResponse> dailyImageGenerations
) {}
