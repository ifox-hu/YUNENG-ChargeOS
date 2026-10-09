#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
export COMPOSE_PROFILES="${COMPOSE_PROFILES:-extras,simulator}"
docker compose config --quiet
docker compose up -d hcp-mysql hcp-redis hcp-nacos
wait_health() {
  for ((attempt=0; attempt<120; attempt++)); do
    if [[ "$(docker inspect --format '{{.State.Health.Status}}' "$1" 2>/dev/null || true)" == healthy ]]; then return; fi
    sleep 3
  done
  echo "Startup timed out: $1. Check docker compose logs $1" >&2
  exit 1
}
wait_health hcp-mysql
wait_health hcp-nacos
for migration in nacos-compat.sql account-login.sql fault-work-order.sql wallet-points.sql; do
  docker exec -i -e MYSQL_PWD=password hcp-mysql mysql --default-character-set=utf8mb4 -uroot vctgo_platform < "$migration"
done
node configure-local.cjs
docker compose build
docker compose up -d
echo 'Services started. Check docker compose ps and access http://<VM-IP>:8001'
