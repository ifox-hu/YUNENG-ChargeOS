#!/usr/bin/env sh
set -eu
# Deliberate topic creation; neither producer nor broker auto-creates business topics.
attempt=0
until docker compose exec -T hcp-mq-broker sh mqadmin updateTopic -n hcp-mq-nameserver:9876 -b 172.18.0.18:10911 -t CHARGE_POINTS_V1 -r 4 -w 4; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then echo 'RocketMQ topic initialization failed' >&2; exit 1; fi
  sleep 2
done
