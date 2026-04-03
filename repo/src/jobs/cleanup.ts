import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { Op, QueryTypes } from 'sequelize';
import { FaceEnrollment, FaceEnrollmentSession } from '../models/face.model';
import { QualityCheck } from '../models/quality.model';
import { sequelize } from '../config/database';
import { createCategoryLogger } from '../utils/logger';
import { runCheck } from '../services/quality.service';

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

// Archive audit logs older than 1 year
async function archiveAuditLogs(): Promise<void> {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // Move old logs to archive table
    const [results] = await sequelize.query(
      `INSERT INTO audit_logs_archive (id, actor_id, action, resource_type, resource_id, detail, trace_id, ip_address, created_at, archived_at)
       SELECT id, actor_id, action, resource_type, resource_id, detail, trace_id, ip_address, created_at, NOW()
       FROM audit_logs WHERE created_at < ?
       ON DUPLICATE KEY UPDATE archived_at = NOW()`,
      { replacements: [oneYearAgo] }
    );

    // Delete archived entries from primary table
    const [delResults] = await sequelize.query(
      'DELETE FROM audit_logs WHERE created_at < ? AND id IN (SELECT id FROM audit_logs_archive)',
      { replacements: [oneYearAgo] }
    );

    logger.info('Audit log archive check completed', { cutoff: oneYearAgo.toISOString() });
  } catch (err) {
    logger.error('Audit log archive failed', { error: err instanceof Error ? err.message : String(err) });
  }
}

export function registerCleanupJobs(): void {
  // Face image cleanup — every 15 minutes
  cron.schedule('*/15 * * * *', cleanupFaceImages);

  // Export archive cleanup — every hour
  cron.schedule('0 * * * *', cleanupExports);

  // Scheduled quality checks — every hour
  cron.schedule('30 * * * *', runScheduledQualityChecks);

  // Audit log archive — daily at 2 AM
  cron.schedule('0 2 * * *', archiveAuditLogs);

  logger.info('Background jobs registered', {
    jobs: ['face-image-cleanup (every 15m)', 'export-cleanup (every 1h)', 'quality-checks (every 1h)', 'audit-archive (daily 2am)'],
  });
}
