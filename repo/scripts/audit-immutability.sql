-- ============================================================================
-- Audit log immutability — production provisioning SQL
-- ============================================================================
--
-- Apply this script ONCE per environment as a privileged MySQL user (root
-- or a DBA role with GRANT OPTION and SUPER privileges). It is idempotent
-- so reruns are safe.
--
-- What it does:
--   1) Ensures the application DB user (`hospitality`) retains INSERT on
--      audit_logs so the app can still write new records.
--   2) REVOKEs UPDATE on audit_logs from the application user — audit
--      records are immutable in place.
--   3) Creates a dedicated `audit_maintainer` user with SELECT + DELETE on
--      audit_logs for the archival retention job, which the app can opt
--      into via AUDIT_MAINTAINER_USER / AUDIT_MAINTAINER_PASSWORD env vars
--      (see src/config/database.ts::createAuditMaintainerConnection).
--   4) Re-asserts the two immutability triggers (audit_logs_block_update
--      and audit_logs_block_delete). These are also installed by
--      migration 017; this script is a belt-and-braces reapplication so
--      the operator can run it post-deploy as a verification step.
--
-- Usage:
--   mysql -u root -p -D hospitality < scripts/audit-immutability.sql
--
-- ============================================================================
-- EDIT THESE VALUES BEFORE RUNNING IN PRODUCTION
-- ============================================================================
SET @db_name        = 'hospitality';
SET @app_user       = 'hospitality';
SET @app_host       = '%';
SET @maint_user     = 'audit_maintainer';
SET @maint_host     = '%';
SET @maint_password = 'CHANGE_ME_STRONG_PASSWORD';
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) App user: keep INSERT, drop UPDATE. DELETE left intact because the
--    trigger already enforces the 1-year cutoff; organizations that want
--    defense-in-depth can additionally REVOKE DELETE and route the
--    archival job through the audit_maintainer credential (below).
-- ---------------------------------------------------------------------------
REVOKE UPDATE ON `hospitality`.`audit_logs` FROM 'hospitality'@'%';
GRANT SELECT, INSERT ON `hospitality`.`audit_logs` TO 'hospitality'@'%';

-- Optional stricter posture (uncomment to enable):
--   REVOKE DELETE ON `hospitality`.`audit_logs` FROM 'hospitality'@'%';
--   The archival cron will then need AUDIT_MAINTAINER_USER/PASSWORD set
--   so it can authenticate as the maintainer role created below.

-- ---------------------------------------------------------------------------
-- 2) Maintainer user for the archival retention job.
-- ---------------------------------------------------------------------------
CREATE USER IF NOT EXISTS 'audit_maintainer'@'%'
  IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';
GRANT SELECT, DELETE ON `hospitality`.`audit_logs` TO 'audit_maintainer'@'%';
GRANT SELECT, INSERT ON `hospitality`.`audit_logs_archive` TO 'audit_maintainer'@'%';

-- ---------------------------------------------------------------------------
-- 3) Immutability triggers (idempotent — drops before create).
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS audit_logs_block_update;
DROP TRIGGER IF EXISTS audit_logs_block_delete;

DELIMITER $$

CREATE TRIGGER audit_logs_block_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'audit_logs is append-only; UPDATE is prohibited';
END$$

CREATE TRIGGER audit_logs_block_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
BEGIN
  IF OLD.created_at >= (NOW() - INTERVAL 1 YEAR) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'audit_logs is immutable for 1 year; cannot DELETE rows newer than retention cutoff';
  END IF;
END$$

DELIMITER ;

-- ---------------------------------------------------------------------------
-- 4) Flush privileges and emit a summary so the operator can confirm.
-- ---------------------------------------------------------------------------
FLUSH PRIVILEGES;

SELECT
  'audit_logs_block_update installed'  AS status
FROM information_schema.triggers
WHERE trigger_schema = DATABASE() AND trigger_name = 'audit_logs_block_update'
UNION ALL
SELECT
  'audit_logs_block_delete installed'  AS status
FROM information_schema.triggers
WHERE trigger_schema = DATABASE() AND trigger_name = 'audit_logs_block_delete';

SHOW GRANTS FOR 'hospitality'@'%';
SHOW GRANTS FOR 'audit_maintainer'@'%';
