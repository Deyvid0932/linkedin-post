CREATE TABLE api_http_429_daily_metrics (
    metric_date DATE NOT NULL,
    route_group VARCHAR(16) NOT NULL CHECK (route_group IN ('auth', 'ai', 'api')),
    response_count BIGINT NOT NULL DEFAULT 0 CHECK (response_count >= 0),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (metric_date, route_group)
);
