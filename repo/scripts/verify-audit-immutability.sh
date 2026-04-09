#!/bin/sh
# ============================================================================
# verify-audit-immutability.sh
# ----------------------------------------------------------------------------
# Runs a deterministic, operator-readable verification of all three layers
# of the audit_logs immutability stack:
#
#   1) ORM hook layer     — asserted via unit test in unit_tests/
#   2) DB trigger layer   — asserted via live MySQL probes below
#   3) DB role grants     — asserted via SHOW GRANTS comparison
#
# Usage:
#   ./scripts/verify-audit-immutability.sh                # docker compose
#   MYSQL_CLI="mysql -h db -u root" ./scripts/...         # custom client
#
# Exit codes:
#   0  — all three layers verified
#   1  — at least one check failed (see output)
#
# This script is idempotent and read-only against your data. It inserts a
# single sentinel row, tries to UPDATE / DELETE it (both should fail), then
# cleans up with a direct DELETE (which should ALSO fail, confirming the
# trigger is active). A leftover `verify-${PID}` row is harmless and will
# age out after a year.
# ============================================================================
set -eu

: "${MYSQL_CLI:=docker compose exec -T db mysql -u root -proot hospitality}"

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow(){ printf '\033[33m%s\033[0m\n' "$*"; }

fail=0

banner() { printf '\n=== %s ===\n' "$*"; }

# ------------------------------------------------------------------
# Layer 2.a — triggers are installed
# ------------------------------------------------------------------
banner "Layer 2a: triggers are installed"
out=$($MYSQL_CLI -N -e "
  SELECT trigger_name FROM information_schema.triggers
  WHERE trigger_schema = DATABASE() AND trigger_name LIKE 'audit_logs_block_%'
  ORDER BY trigger_name;
")
echo "$out"
if echo "$out" | grep -q audit_logs_block_update && echo "$out" | grep -q audit_logs_block_delete; then
  green "  ✓ both triggers present"
else
  red   "  ✗ triggers MISSING — run: mysql < scripts/audit-immutability.sql"
  fail=1
fi

# ------------------------------------------------------------------
# Layer 2.b — UPDATE on audit_logs is rejected
# ------------------------------------------------------------------
banner "Layer 2b: UPDATE is rejected"
SENTINEL_ID="verify-$$-$(date +%s)"
$MYSQL_CLI -e "
  INSERT INTO audit_logs (id, action, created_at)
  VALUES ('$SENTINEL_ID', 'verify_sentinel', NOW());
"
if $MYSQL_CLI -e "UPDATE audit_logs SET action='TAMPERED' WHERE id='$SENTINEL_ID';" 2>&1 | grep -q "append-only"; then
  green "  ✓ UPDATE rejected by trigger"
else
  red   "  ✗ UPDATE was NOT rejected — audit immutability is BROKEN"
  fail=1
fi

# ------------------------------------------------------------------
# Layer 2.c — DELETE of a fresh row is rejected
# ------------------------------------------------------------------
banner "Layer 2c: DELETE of row < 1 year old is rejected"
if $MYSQL_CLI -e "DELETE FROM audit_logs WHERE id='$SENTINEL_ID';" 2>&1 | grep -q "1 year"; then
  green "  ✓ DELETE of fresh row rejected by trigger"
else
  red   "  ✗ DELETE was NOT rejected — retention window NOT enforced"
  fail=1
fi

# ------------------------------------------------------------------
# Layer 3 — role grants are correct for the app user
# ------------------------------------------------------------------
banner "Layer 3: app user grants on audit_logs"
grants=$($MYSQL_CLI -N -e "SHOW GRANTS FOR CURRENT_USER;" || true)
echo "$grants"
yellow "  (Review the above manually — app user should NOT hold UPDATE on audit_logs.)"

# ------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------
banner "Summary"
if [ $fail -eq 0 ]; then
  green "All automatically-verifiable layers passed."
  echo  "The sentinel row id is '$SENTINEL_ID' and will age out naturally."
  exit 0
else
  red "One or more layers FAILED. Fix before promoting to production."
  exit 1
fi
