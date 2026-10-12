-- Run after wallet-points.sql. Existing historical orders are not backfilled.
CREATE TABLE IF NOT EXISTS c_points_event (
  event_id varchar(64) NOT NULL PRIMARY KEY,
  order_id varchar(64) NOT NULL,
  member_id bigint NOT NULL,
  tenant_id bigint NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'PENDING',
  publish_attempts int NOT NULL DEFAULT 0,
  consume_failures int NOT NULL DEFAULT 0,
  next_retry_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_token varchar(64) DEFAULT NULL,
  last_error varchar(500) DEFAULT NULL,
  message_id varchar(128) DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  consumed_at datetime DEFAULT NULL,
  UNIQUE KEY uk_points_order(order_id),
  KEY idx_points_retry(status,next_retry_at),
  KEY idx_points_tenant(tenant_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
