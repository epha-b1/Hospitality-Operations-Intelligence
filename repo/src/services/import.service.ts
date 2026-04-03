import { v4 as uuidv4 } from 'uuid';
import ExcelJS from 'exceljs';
import { QueryTypes } from 'sequelize';
import { ImportBatch, ImportError, StaffingRecord, EvaluationRecord } from '../models/import.model';
import { AppError } from '../utils/errors';
import { sequelize } from '../config/database';
import { traceStore, createCategoryLogger } from '../utils/logger';

const logger = createCategoryLogger('import');

const STAFFING_COLUMNS = ['employee_id', 'effective_date', 'position', 'department', 'property_id', 'signed_off_by'];
const STAFFING_REQUIRED = ['employee_id', 'effective_date', 'position'];
const EVAL_COLUMNS = ['employee_id', 'effective_date', 'score', 'result', 'rewards', 'penalties', 'signed_off_by'];
const EVAL_REQUIRED = ['employee_id', 'effective_date', 'score', 'result'];
const MAX_RETRY_ATTEMPTS = 3;

export async function getTemplate(datasetType: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(datasetType);
  ws.addRow(datasetType === 'staffing' ? STAFFING_COLUMNS : EVAL_COLUMNS);
  return wb;
}

function parseRows(ws: ExcelJS.Worksheet, headers: string[], datasetType: string) {
  const errors: { rowNumber: number; field: string | null; reason: string }[] = [];
  const validRows: Record<string, string>[] = [];
  const required = datasetType === 'staffing' ? STAFFING_REQUIRED : EVAL_REQUIRED;

  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const data: Record<string, string> = {};
    headers.forEach((h, i) => { data[h] = row.getCell(i + 1).text?.trim() || ''; });

    let hasError = false;
    for (const req of required) {
      if (!data[req]) { errors.push({ rowNumber: rowNum, field: req, reason: `${req} is required` }); hasError = true; }
    }
    if (data.effective_date && !/^\d{4}-\d{2}-\d{2}$/.test(data.effective_date)) {
      errors.push({ rowNumber: rowNum, field: 'effective_date', reason: 'Must be YYYY-MM-DD' }); hasError = true;
    }
    if (datasetType === 'evaluation' && data.score && isNaN(Number(data.score))) {
      errors.push({ rowNumber: rowNum, field: 'score', reason: 'Must be a number' }); hasError = true;
    }
    if (!hasError) validRows.push(data);
  });

  return { errors, validRows, totalRows: validRows.length + errors.length };
}

export async function uploadAndValidate(userId: string, datasetType: string, buffer: Buffer) {
  const batchId = uuidv4();
  const traceId = traceStore.getStore()?.traceId || null;

  const batch = await ImportBatch.create({
    id: batchId, user_id: userId, batch_type: datasetType,
    status: 'pending', trace_id: traceId, created_at: new Date(),
  });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new AppError(400, 'VALIDATION_ERROR', 'No worksheet found');

  const headers = (ws.getRow(1).values as string[]).slice(1).map(h => String(h).trim().toLowerCase());
  const required = datasetType === 'staffing' ? STAFFING_REQUIRED : EVAL_REQUIRED;
  const missing = required.filter(r => !headers.includes(r));
  if (missing.length > 0) throw new AppError(400, 'VALIDATION_ERROR', `Missing required columns: ${missing.join(', ')}`);

  const { errors, validRows, totalRows } = parseRows(ws, headers, datasetType);

  for (const err of errors) {
    await ImportError.create({ id: uuidv4(), batch_id: batchId, row_number: err.rowNumber, field: err.field, reason: err.reason });
  }

  // Store valid rows as JSON in batch for commit phase
  await ImportBatch.update({
    total_rows: totalRows, error_rows: errors.length,
    success_rows: validRows.length, status: 'pending',
  }, { where: { id: batchId } });

  // Store parsed valid rows in a temp table approach — we use import_errors with a special marker
  // Actually, store them serialized. Simpler: re-attach to batch via a data column.
  // For production grade, we store the valid rows in a JSON blob on the batch.
  // Since ImportBatch doesn't have a data column, we store in a temp file.
  if (validRows.length > 0) {
    const fs = require('fs');
    const pathMod = require('path');
    const tmpDir = pathMod.resolve('var/import-tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(pathMod.resolve(tmpDir, `.import-${batchId}.json`), JSON.stringify({ datasetType, validRows }));
  }

  return { batchId, totalRows, validRows: validRows.length, errorRows: errors.length, errors };
}

export async function commitBatch(batchId: string, userId: string) {
  const batch = await ImportBatch.findByPk(batchId);
  if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');
  if (batch.user_id !== userId) throw new AppError(403, 'FORBIDDEN', 'Not authorized for this batch');
  if (batch.status === 'completed') throw new AppError(409, 'CONFLICT', 'Already committed');
  if (batch.status === 'failed') throw new AppError(409, 'CONFLICT', 'Batch failed');

  const fs = require('fs');
  const pathMod = require('path');
  const dataPath = pathMod.resolve(`var/import-tmp/.import-${batchId}.json`);

  let datasetType: string;
  let validRows: Record<string, string>[];
  try {
    const raw = fs.readFileSync(dataPath, 'utf8');
    const parsed = JSON.parse(raw);
    datasetType = parsed.datasetType;
    validRows = parsed.validRows;
  } catch {
    // No valid rows to commit
    await ImportBatch.update({ status: 'completed', completed_at: new Date() }, { where: { id: batchId } });
    return ImportBatch.findByPk(batchId);
  }

  let attempt = 0;
  while (attempt < MAX_RETRY_ATTEMPTS) {
    attempt++;
    const t = await sequelize.transaction();
    try {
      await ImportBatch.update({ status: 'processing' }, { where: { id: batchId }, transaction: t });

      let inserted = 0;
      for (const row of validRows) {
        if (datasetType === 'staffing') {
          // Upsert by (employee_id, effective_date)
          const existing = await StaffingRecord.findOne({
            where: { employee_id: row.employee_id, effective_date: row.effective_date },
            transaction: t,
          });
          if (existing) {
            await StaffingRecord.update({
              position: row.position,
              department: row.department || null,
              property_id: row.property_id || null,
              signed_off_by: row.signed_off_by || null,
              batch_id: batchId,
            }, { where: { id: existing.id }, transaction: t });
          } else {
            await StaffingRecord.create({
              id: uuidv4(), batch_id: batchId,
              employee_id: row.employee_id, effective_date: row.effective_date,
              position: row.position, department: row.department || null,
              property_id: row.property_id || null, signed_off_by: row.signed_off_by || null,
              created_at: new Date(),
            }, { transaction: t });
          }
          inserted++;
        } else {
          // evaluation — upsert by (employee_id, effective_date)
          const existing = await EvaluationRecord.findOne({
            where: { employee_id: row.employee_id, effective_date: row.effective_date },
            transaction: t,
          });
          if (existing) {
            await EvaluationRecord.update({
              score: row.score ? Number(row.score) : null,
              result: row.result || null,
              rewards: row.rewards || null,
              penalties: row.penalties || null,
              signed_off_by: row.signed_off_by || null,
              batch_id: batchId,
            }, { where: { id: existing.id }, transaction: t });
          } else {
            await EvaluationRecord.create({
              id: uuidv4(), batch_id: batchId,
              employee_id: row.employee_id, effective_date: row.effective_date,
              score: row.score ? Number(row.score) : null, result: row.result || null,
              rewards: row.rewards || null, penalties: row.penalties || null,
              signed_off_by: row.signed_off_by || null, created_at: new Date(),
            }, { transaction: t });
          }
          inserted++;
        }
      }

      await ImportBatch.update({
        status: 'completed', completed_at: new Date(), success_rows: inserted,
      }, { where: { id: batchId }, transaction: t });

      await t.commit();
      try { fs.unlinkSync(dataPath); } catch { /* ok */ }
      logger.info('Import batch committed', { batchId, attempt, inserted });
      return ImportBatch.findByPk(batchId);
    } catch (err) {
      await t.rollback();
      if (attempt >= MAX_RETRY_ATTEMPTS) {
        await ImportBatch.update({ status: 'failed' }, { where: { id: batchId } });
        logger.error('Import batch failed after max retries', { batchId, attempt });
        throw err;
      }
      const delay = Math.pow(2, attempt - 1) * 1000;
      logger.warn('Import batch retry', { batchId, attempt, delayMs: delay });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export async function getBatch(batchId: string, userId: string) {
  const batch = await ImportBatch.findByPk(batchId, { include: [{ model: ImportError, as: 'errors' }] });
  if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');
  if (batch.user_id !== userId) throw new AppError(403, 'FORBIDDEN', 'Not authorized for this batch');
  return batch;
}

export async function staffingReport(params: { propertyId?: string; from?: string; to?: string }) {
  const clauses: string[] = [];
  const replacements: string[] = [];
  if (params.propertyId) { clauses.push('s.property_id = ?'); replacements.push(params.propertyId); }
  if (params.from) { clauses.push('s.effective_date >= ?'); replacements.push(params.from); }
  if (params.to) { clauses.push('s.effective_date <= ?'); replacements.push(params.to); }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';

  const distribution = await sequelize.query(
    `SELECT position, COUNT(*) as count FROM staffing_records s ${where} GROUP BY position ORDER BY count DESC`,
    { replacements, type: QueryTypes.SELECT }
  );
  return { positionDistribution: distribution };
}

export async function evaluationReport(params: { propertyId?: string; from?: string; to?: string }) {
  const clauses: string[] = [];
  const replacements: string[] = [];
  if (params.from) { clauses.push('e.effective_date >= ?'); replacements.push(params.from); }
  if (params.to) { clauses.push('e.effective_date <= ?'); replacements.push(params.to); }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';

  const summary = await sequelize.query(
    `SELECT result, COUNT(*) as count, AVG(score) as avg_score FROM evaluation_records e ${where} GROUP BY result ORDER BY count DESC`,
    { replacements, type: QueryTypes.SELECT }
  );
  return { resultsSummary: summary };
}
