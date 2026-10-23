CREATE TABLE api_request_daily_metrics (
    metric_date DATE NOT NULL,
    route_group VARCHAR(16) NOT NULL CHECK (route_group IN ('auth', 'ai', 'api')),
    status_class SMALLINT NOT NULL CHECK (status_class BETWEEN 2 AND 5),
    request_count BIGINT NOT NULL DEFAULT 0 CHECK (request_count >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (metric_date, route_group, status_class)
);

CREATE TABLE api_request_metric_metadata (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    tracking_started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO api_request_metric_metadata (id, tracking_started_at)
VALUES (1, CURRENT_TIMESTAMP);
