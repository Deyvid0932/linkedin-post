CREATE TABLE api_http_429_metric_metadata (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    tracking_started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO api_http_429_metric_metadata (id, tracking_started_at)
VALUES (1, CURRENT_TIMESTAMP);
