import { Response, NextFunction } from 'express';
import { Op, WhereOptions } from 'sequelize';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { AuditLog } from '../models/audit.model';

const SENSITIVE_FIELDS = ['password', 'password_hash', 'token', 'accessToken', 'encryption_key', 'secret'];

function maskSensitive(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.some(f => k.toLowerCase().includes(f))) result[k] = '[REDACTED]';
    else result[k] = v;
  }
  return result;
}

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
      data: rows.map(r => ({ ...r.toJSON(), detail: maskSensitive(r.detail) })),
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
    const header = 'id,actor_id,action,resource_type,resource_id,trace_id,ip_address,created_at\n';
    const csv = rows.map(r => `${r.id},${r.actor_id || ''},${r.action},${r.resource_type || ''},${r.resource_id || ''},${r.trace_id || ''},${r.ip_address || ''},${r.created_at}`).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.send(header + csv);
  } catch (e) { next(e); }
}
