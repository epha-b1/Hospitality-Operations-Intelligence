import { Response, NextFunction } from 'express';
import { Op, WhereOptions } from 'sequelize';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { AuditLog } from '../models/audit.model';
import { maskSensitiveDeep } from '../utils/masking';
import { objectsToCsv } from '../utils/csv';

/**
 * Single source of truth for rendering an AuditLog row to any audience.
 *
 * Every audit output path — JSON query, CSV export, future formats —
 * MUST go through this function so the masking policy cannot drift
 * between surfaces. Directly calling `row.toJSON()` for audit output
 * is a bug; call `serializeAuditRow(row)` instead.
 *
 * Input is the model instance (or any object with a compatible shape);
 * output is a plain object with `detail` deep-masked.
 */
export function serializeAuditRow(row: AuditLog): Record<string, unknown> {
  const json = row.toJSON() as Record<string, unknown>;
  json.detail = maskSensitiveDeep((row as any).detail ?? json.detail);
  return json;
}

// Column order for CSV export — extracted so tests can assert the schema
// does not drift, and so masking is applied before serialization.
export const AUDIT_CSV_COLUMNS = [
  'id',
  'actor_id',
  'action',
  'resource_type',
  'resource_id',
  'trace_id',
  'ip_address',
  'created_at',
  'detail',
] as const;

function buildDateFilter(from?: string, to?: string): Record<symbol, unknown> | undefined {
  if (!from && !to) return undefined;
  const filter: Record<symbol, unknown> = {};
  if (from) filter[Op.gte] = from;
  if (to) filter[Op.lte] = to;
  return filter;
}

export async function queryLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const where: WhereOptions = {};
    if (req.query.actorId) (where as any).actor_id = req.query.actorId;
    if (req.query.action) (where as any).action = req.query.action;
    if (req.query.resourceType) (where as any).resource_type = req.query.resourceType;
    const dateFilter = buildDateFilter(req.query.from as string, req.query.to as string);
    if (dateFilter) (where as any).created_at = dateFilter;

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 50;
    const { count, rows } = await AuditLog.findAndCountAll({ where, order: [['created_at', 'DESC']], limit, offset: (page - 1) * limit });

    res.json({
      data: rows.map(serializeAuditRow),
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (e) { next(e); }
}

export async function exportLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const where: WhereOptions = {};
    const dateFilter = buildDateFilter(req.query.from as string, req.query.to as string);
    if (dateFilter) (where as any).created_at = dateFilter;

    const rows = await AuditLog.findAll({ where, order: [['created_at', 'DESC']] });

    // Deep-mask each row's detail JSON before it hits the wire. Export MUST
    // apply the same default masking policy as the query endpoint — a CSV
    // consumer should never see secrets that the JSON endpoint would hide.
    // Routing through serializeAuditRow guarantees this cannot drift.
    const serialized = rows.map(serializeAuditRow);
    const csv = objectsToCsv(serialized, [...AUDIT_CSV_COLUMNS]);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    res.send(csv);
  } catch (e) { next(e); }
}
