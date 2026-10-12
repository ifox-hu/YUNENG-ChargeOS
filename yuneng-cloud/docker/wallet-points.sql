-- Wallet and points tables for mini-program demo. Repeatable migration.
CREATE TABLE IF NOT EXISTS c_member_balance_ledger (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  member_id BIGINT NOT NULL,
  request_id VARCHAR(80) NOT NULL,
  type VARCHAR(30) NOT NULL,
  amount DECIMAL(18,6) NOT NULL,
  balance_after DECIMAL(18,6) NOT NULL,
  remark VARCHAR(255) NULL,
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_balance_request (member_id, request_id),
  KEY idx_balance_member_time (member_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS c_member_points_ledger (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  member_id BIGINT NOT NULL,
  business_key VARCHAR(120) NOT NULL,
  type VARCHAR(30) NOT NULL,
  points INT NOT NULL,
  balance_after INT NOT NULL,
  remark VARCHAR(255) NULL,
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_points_business (member_id, business_key),
  KEY idx_points_member_time (member_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
