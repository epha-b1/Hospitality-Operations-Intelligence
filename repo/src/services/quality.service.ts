import { v4 as uuidv4 } from 'uuid';
import { Op, QueryTypes } from 'sequelize';
import { QualityCheck, OperationalMetric } from '../models/quality.model';
import { sequelize } from '../config/database';
import { AppError } from '../utils/errors';
import { traceStore, createCategoryLogger } from '../utils/logger';

const logger = createCategoryLogger('system');

const TABLE_MAP: Record<string, string> = {
  reservations: 'reservations', staffing: 'staffing_records', evaluations: 'evaluation_records', users: 'users', files: 'files',
};

// Map entity to nullable columns for null coverage checks
const NULLABLE_COLUMNS: Record<string, string[]> = {
  reservations: ['guest_name', 'channel'],
  staffing_records: ['department', 'property_id', 'signed_off_by'],
  evaluation_records: ['score', 'result', 'rewards', 'penalties', 'signed_off_by'],
  users: ['legal_name', 'address_line1', 'city', 'state', 'zip'],
  files: ['group_id'],
};

export async function createCheck(data: { entityType: string; checkType: string; config: Record<string, unknown> }) {
  return QualityCheck.create({ id: uuidv4(), entity_type: data.entityType, check_type: data.checkType, config: data.config });
}

export async function listChecks() {
  return QualityCheck.findAll({ order: [['entity_type', 'ASC']] });
}

export async function runCheck(checkId: string) {
  const startTime = Date.now();
  const check = await QualityCheck.findByPk(checkId);
  if (!check) throw new AppError(404, 'NOT_FOUND', 'Check not found');

  const table = TABLE_MAP[check.entity_type];
  if (!table) throw new AppError(400, 'VALIDATION_ERROR', `Unknown entity type: ${check.entity_type}`);

  let result: Record<string, unknown> = {};
  let passed = true;
  const traceId = traceStore.getStore()?.traceId || null;

  if (check.check_type === 'null_coverage') {
    const threshold = (check.config as any).threshold || 0.05;
    const [countRow] = await sequelize.query(`SELECT COUNT(*) as total FROM \`${table}\``, { type: QueryTypes.SELECT }) as any[];
    const total = Number(countRow.total);

    if (total === 0) {
      result = { total: 0, threshold, nullRatio: 0, columns: {} };
      passed = true;
    } else {
      const cols = NULLABLE_COLUMNS[table] || [];
      const colResults: Record<string, { nullCount: number; ratio: number }> = {};
      let maxRatio = 0;

      for (const col of cols) {
        const [r] = await sequelize.query(`SELECT COUNT(*) as cnt FROM \`${table}\` WHERE \`${col}\` IS NULL OR \`${col}\` = ''`, { type: QueryTypes.SELECT }) as any[];
        const nullCount = Number(r.cnt);
        const ratio = nullCount / total;
        colResults[col] = { nullCount, ratio: Math.round(ratio * 10000) / 10000 };
        if (ratio > maxRatio) maxRatio = ratio;
      }
      passed = maxRatio <= threshold;
      result = { total, threshold, maxNullRatio: Math.round(maxRatio * 10000) / 10000, columns: colResults };
    }
  } else if (check.check_type === 'duplication_ratio') {
    const threshold = (check.config as any).threshold || 0.02;
    const [countRow] = await sequelize.query(`SELECT COUNT(*) as total FROM \`${table}\``, { type: QueryTypes.SELECT }) as any[];
    const total = Number(countRow.total);

    // Count duplicate rows by all non-id columns — simplified: count by distinct vs total
    const [distinctRow] = await sequelize.query(`SELECT COUNT(*) as cnt FROM (SELECT DISTINCT * FROM \`${table}\`) as t`, { type: QueryTypes.SELECT }) as any[];
    const distinct = Number(distinctRow.cnt);
    const dupCount = total - distinct;
    const dupRatio = total > 0 ? dupCount / total : 0;
    passed = dupRatio <= threshold;
    result = { total, distinct, duplicates: dupCount, dupRatio: Math.round(dupRatio * 10000) / 10000, threshold };
  } else if (check.check_type === 'outlier') {
    const zBound = (check.config as any).zScoreBound || 3.0;
    const fields: string[] = (check.config as any).fields || [];
    const outliers: Record<string, { mean: number; stddev: number; outlierCount: number; zBound: number }> = {};

    for (const field of fields) {
      const [stats] = await sequelize.query(
        `SELECT AVG(\`${field}\`) as mean, STDDEV(\`${field}\`) as stddev FROM \`${table}\` WHERE \`${field}\` IS NOT NULL`,
        { type: QueryTypes.SELECT }
      ) as any[];
      const mean = Number(stats.mean) || 0;
      const stddev = Number(stats.stddev) || 0;

      if (stddev > 0) {
        const [outlierRow] = await sequelize.query(
          `SELECT COUNT(*) as cnt FROM \`${table}\` WHERE \`${field}\` IS NOT NULL AND ABS((\`${field}\` - ?) / ?) > ?`,
          { replacements: [mean, stddev, zBound], type: QueryTypes.SELECT }
        ) as any[];
        outliers[field] = { mean: Math.round(mean * 100) / 100, stddev: Math.round(stddev * 100) / 100, outlierCount: Number(outlierRow.cnt), zBound };
        if (Number(outlierRow.cnt) > 0) passed = false;
      } else {
        outliers[field] = { mean, stddev: 0, outlierCount: 0, zBound };
      }
    }
    result = { zScoreBound: zBound, fields: outliers };
  }

  const duration = Date.now() - startTime;
  await QualityCheck.update({ result, passed, run_at: new Date(), trace_id: traceId }, { where: { id: checkId } });

  // Record operational metric
  await OperationalMetric.create({
    id: uuidv4(), metric_name: 'quality_check_duration_ms',
    metric_value: duration, labels: { checkId, checkType: check.check_type, entityType: check.entity_type },
    trace_id: traceId, recorded_at: new Date(),
  });

  return { passed, result, traceId };
}

export async function getResults() {
  return QualityCheck.findAll({ where: { run_at: { [Op.ne]: null } }, order: [['run_at', 'DESC']] });
}

// Record a generic operational metric
export async function recordMetric(name: string, value: number, labels?: Record<string, unknown>) {
  await OperationalMetric.create({
    id: uuidv4(), metric_name: name, metric_value: value,
    labels: labels || null, trace_id: traceStore.getStore()?.traceId || null,
    recorded_at: new Date(),
  });
}
