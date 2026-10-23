package com.deyvid.backend.security;

public interface RequestRateLimitStore {
    Decision consume(String bucketKey, int limitPerMinute);

    void deleteExpiredBuckets();

    record Decision(boolean allowed, double remainingTokens) {}
}
