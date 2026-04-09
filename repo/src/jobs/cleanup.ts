import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { Op, QueryTypes } from 'sequelize';
import { FaceEnrollment, FaceEnrollmentSession } from '../models/face.model';
import { QualityCheck } from '../models/quality.model';
import { sequelize, createAuditMaintainerConnection } from '../config/database';
import { createCategoryLogger } from '../utils/logger';
import { runCheck } from '../services/quality.service';
import { cleanupStaleImportTmp } from '../services/import.service';

const logger = createCategoryLogger('system');

// Hard-delete raw face images past 24h retention
async function cleanupFaceImages(): Promise<void> {
  try {
    const expired = await FaceEnrollment.findAll({
      where: {
        raw_image_path: { [Op.ne]: null },
        raw_image_expires_at: { [Op.lt]: new Date() },
      },
    });

    for (const enrollment of expired) {
      if (enrollment.raw_image_path) {
        // raw_image_path may contain multiple paths separated by semicolons
        for (const imgPath of enrollment.raw_image_path.split(';')) {
          try { fs.unlinkSync(path.resolve(imgPath.trim())); } catch { /* already gone */ }
        }
      }
      await FaceEnrollment.update(
        { raw_image_path: null, raw_image_expires_at: null },
        { where: { id: enrollment.id } }
      );
    }

    // Expire stale sessions (30 min)
    await FaceEnrollmentSession.update(
      { status: 'expired' },
      { where: { status: 'in_progress', expires_at: { [Op.lt]: new Date() } } }
    );

    if (expired.length > 0) {
      logger.info('Face image cleanup completed', { deletedCount: expired.length });
    }
  } catch (err) {
    logger.error('Face image cleanup failed', { error: err instanceof Error ? err.message : String(err) });
  }
}

// Delete generated export archives past 24h
async function cleanupExports(): Promise<void> {
  try {
    const exportsDir = path.resolve('exports');
    if (!fs.existsSync(exportsDir)) return;

    const files = fs.readdirSync(exportsDir);
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of files) {
      if (file === '.gitkeep') continue;
      // Stray import staging files never belong under exports/ — sweep any
      // legacy leftovers immediately regardless of age. Current code writes
      // them under var/import-tmp instead, but this keeps the exports dir
      // clean against historical drift.
      if (file.startsWith('.import-')) {
        try { fs.unlinkSync(path.join(exportsDir, file)); deletedCount++; } catch { /* ok */ }
        continue;
      }
      const filePath = path.join(exportsDir, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      logger.info('Export cleanup completed', { deletedCount });
    }
  } catch (err) {
    logger.error('Export cleanup failed', { error: err instanceof Error ? err.message : String(err) });
  }
}

// Delete orphaned import staging files whose commit never arrived.
async function cleanupImportTmp(): Promise<void> {
  try {
    const deleted = cleanupStaleImportTmp();
    if (deleted > 0) logger.info('Import tmp cleanup completed', { deletedCount: deleted });
  } catch (err) {
    logger.error('Import tmp cleanup failed', { error: err instanceof Error ? err.message : String(err) });
  }
}

// Run all configured quality checks
async function runScheduledQualityChecks(): Promise<void> {
  try {
    const checks = await QualityCheck.findAll();
    for (const check of checks) {
      try {
        await runCheck(check.id);
      } catch (err) {
        logger.error('Scheduled quality check failed', { checkId: check.id, error: err instanceof Error ? err.message : String(err) });
      }
    }
    if (checks.length > 0) {
      logger.info('Scheduled quality checks completed', { count: checks.length });
    }
  } catch (err) {
    logger.error('Quality check scheduler failed', { error: err instanceof Error ? err.message : String(err) });
  }
}

// Archive audit logs older than 1 year.
//
// Uses an elevated `audit_maintainer` Sequelize instance when the
// AUDIT_MAINTAINER_USER / AUDIT_MAINTAINER_PASSWORD env vars are set.
// Otherwise falls back to the main pool — safe because the DB trigger
// installed by migration 017 independently rejects DELETE of rows newer
// than 1 year, so even the fallback cannot violate retention.
//
// The two-phase INSERT-then-DELETE is safe under trigger enforcement:
//   * INSERT into archive: unaffected by the trigger (different table)
//   * DELETE from audit_logs: rejected by trigger for rows newer than 1y,
//     accepted for older rows. We explicitly bound the WHERE clause to
//     rows older than 1 year so every DELETE that fires should be allowed.
export async function archiveAuditLogs(): Promise<void> {
  const maintainer = createAuditMaintainerConnection();
  const conn = maintainer ?? sequelize;
  const credentialLabel = maintainer ? 'audit_maintainer' : 'app_pool';

  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // Move old logs to archive table (idempotent via ON DUPLICATE KEY).
    await conn.query(
      `INSERT INTO audit_logs_archive (id, actor_id, action, resource_type, resource_id, detail, trace_id, ip_address, created_at, archived_at)
       SELECT id, actor_id, action, resource_type, resource_id, detail, trace_id, ip_address, created_at, NOW()
       FROM audit_logs WHERE created_at < ?
       ON DUPLICATE KEY UPDATE archived_at = NOW()`,
      { replacements: [oneYearAgo] }
    );

    // Delete archived entries from primary table. The trigger guarantees
    // this can only succeed for rows older than 1 year. We still scope
    // the WHERE clause by the same cutoff to avoid ever asking the DB
    // to reject a legitimate-looking but newer row.
    await conn.query(
      'DELETE FROM audit_logs WHERE created_at < ? AND id IN (SELECT id FROM audit_logs_archive)',
      { replacements: [oneYearAgo] }
    );

    logger.info('Audit log archive check completed', {
      cutoff: oneYearAgo.toISOString(),
      credential: credentialLabel,
    });
  } catch (err) {
    // A SIGNAL 45000 from the trigger means someone tried to delete a
    // row newer than 1 year — log it as a loud error (someone is
    // probably running an out-of-band job) but do NOT suppress it.
    logger.error('Audit log archive failed', {
      error: err instanceof Error ? err.message : String(err),
      credential: credentialLabel,
    });
  } finally {
    if (maintainer) {
      try { await maintainer.close(); } catch { /* pool already down */ }
    }
  }
}

export function registerCleanupJobs(): void {
  // Face image cleanup — every 15 minutes
  cron.schedule('*/15 * * * *', cleanupFaceImages);

  // Export archive cleanup — every hour
  cron.schedule('0 * * * *', cleanupExports);

  // Orphaned import staging cleanup — every hour
  cron.schedule('15 * * * *', cleanupImportTmp);

  // Scheduled quality checks — every hour
  cron.schedule('30 * * * *', runScheduledQualityChecks);

  // Audit log archive — daily at 2 AM
  cron.schedule('0 2 * * *', archiveAuditLogs);

  logger.info('Background jobs registered', {
    jobs: [
      'face-image-cleanup (every 15m)',
      'export-cleanup (every 1h)',
      'import-tmp-cleanup (every 1h)',
      'quality-checks (every 1h)',
      'audit-archive (daily 2am)',
    ],
  });
}
