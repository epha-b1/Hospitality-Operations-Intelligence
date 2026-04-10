#!/bin/sh
set -e

COMPOSE="docker compose"

# ── Step 1: Ensure containers are running ──────────────────────────────────
echo "=== Step 1: Checking containers ==="

API_RUNNING=$($COMPOSE ps --status running --format '{{.Service}}' 2>/dev/null | grep -c '^api$' || true)

if [ "$API_RUNNING" -eq 0 ]; then
  echo "  API container not running — starting..."
  $COMPOSE up -d --build
else
  # Running but maybe not healthy — check if it responds
  if ! $COMPOSE exec -T api wget -qO- http://localhost:3000/health >/dev/null 2>&1; then
    echo "  API container running but not responding — restarting..."
    $COMPOSE restart api
  else
    echo "  API container is running and responding."
  fi
fi

# ── Step 2: Wait for API to be healthy ─────────────────────────────────────
echo ""
echo "=== Step 2: Waiting for API health ==="

TRIES=0
MAX_TRIES=120
while [ $TRIES -lt $MAX_TRIES ]; do
  if $COMPOSE exec -T api wget -qO- http://localhost:3000/health >/dev/null 2>&1; then
    echo "  API is healthy after ${TRIES}s."
    break
  fi
  TRIES=$((TRIES + 1))
  printf "  Waiting... %ds\r" "$TRIES"
  sleep 1
done

if [ $TRIES -ge $MAX_TRIES ]; then
  echo ""
  echo "  ERROR: API did not become healthy within ${MAX_TRIES}s."
  echo ""
  echo "  === Container logs ==="
  $COMPOSE logs --tail=50 api
  exit 1
fi

# ── Step 3: Unit tests ────────────────────────────────────────────────────
echo ""
echo "=== Step 3: Running unit tests ==="

UNIT_EXIT=0
$COMPOSE exec -T api npx jest --selectProjects=unit --verbose --no-cache || UNIT_EXIT=$?

# ── Step 4: API tests ─────────────────────────────────────────────────────
echo ""
echo "=== Step 4: Running API tests ==="

API_EXIT=0
$COMPOSE exec -T api npx jest --selectProjects=api --verbose --no-cache --runInBand || API_EXIT=$?

# ── Summary ───────────────────────────────────────────────────────────────
echo ""
echo "========================================"
echo "  Unit tests:  $([ $UNIT_EXIT -eq 0 ] && echo 'PASSED' || echo 'FAILED')"
echo "  API  tests:  $([ $API_EXIT  -eq 0 ] && echo 'PASSED' || echo 'FAILED')"
echo "========================================"

[ $UNIT_EXIT -eq 0 ] && [ $API_EXIT -eq 0 ] && echo "  ALL PASSED" || { echo "  SOME TESTS FAILED"; exit 1; }
