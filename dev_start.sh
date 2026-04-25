#!/bin/bash
# StudyBuddy Q — local dev orchestration

set -euo pipefail

cd "$(dirname "$0")"

cmd="${1:-up}"

case "$cmd" in
  up)
    echo "→ Starting stack..."
    docker compose up -d --build
    echo "→ Waiting for /healthz..."
    for i in {1..30}; do
      if curl -fs http://localhost:8000/healthz >/dev/null 2>&1; then
        echo "✓ API healthy at http://localhost:8000"
        exit 0
      fi
      sleep 1
    done
    echo "✗ API did not become healthy in 30s"
    docker compose logs --tail=50 api
    exit 1
    ;;

  test)
    echo "→ Running backend tests..."
    docker compose exec api pytest -v
    ;;

  stop)
    echo "→ Stopping stack..."
    docker compose down
    ;;

  reset)
    echo "→ Wiping volumes and stopping..."
    docker compose down -v
    ;;

  logs)
    docker compose logs -f --tail=100 api
    ;;

  *)
    echo "Usage: $0 {up|test|stop|reset|logs}"
    exit 2
    ;;
esac
