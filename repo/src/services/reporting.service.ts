import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';

interface ReportParams { propertyId?: string; from: string; to: string; groupBy?: string; roomType?: string; }

function scopeWhere(params: ReportParams, managerPropertyId?: string): { clauses: string[]; replacements: unknown[] } {
  const clauses: string[] = [];
  const replacements: unknown[] = [];
  const propId = managerPropertyId || params.propertyId;
  if (propId) { clauses.push('r.property_id = ?'); replacements.push(propId); }
  clauses.push('r.check_in_date <= ?'); replacements.push(params.to);
  clauses.push('r.check_out_date >= ?'); replacements.push(params.from);
  if (params.roomType) { clauses.push('rm.room_type = ?'); replacements.push(params.roomType); }
  return { clauses, replacements };
}

function roomCountSubquery(propId?: string): { sql: string; replacements: unknown[] } {
  if (propId) {
    return { sql: "(SELECT COUNT(*) FROM rooms rm2 WHERE rm2.status != 'maintenance' AND rm2.property_id = ?)", replacements: [propId] };
  }
  return { sql: "(SELECT COUNT(*) FROM rooms rm2 WHERE rm2.status != 'maintenance')", replacements: [] };
}

function groupByExpr(groupBy: string): string {
  switch (groupBy) {
    case 'week': return "DATE_FORMAT(r.check_in_date, '%x-W%v')";
    case 'month': return "DATE_FORMAT(r.check_in_date, '%Y-%m')";
    default: return 'r.check_in_date';
  }
}

export async function occupancy(params: ReportParams, managerPropertyId?: string) {
  const gb = groupByExpr(params.groupBy || 'day');
  const { clauses, replacements } = scopeWhere(params, managerPropertyId);
  clauses.push("r.status IN ('confirmed','checked_in','checked_out')");
  const where = 'WHERE ' + clauses.join(' AND ');

  const rc = roomCountSubquery(managerPropertyId || params.propertyId);
  const allReplacements = [...rc.replacements, ...replacements];

  const sql = `SELECT ${gb} as period, COUNT(DISTINCT r.room_id) as occupied_rooms, ${rc.sql} as total_rooms
    FROM reservations r LEFT JOIN rooms rm ON r.room_id = rm.id ${where} GROUP BY period ORDER BY period`;
  return sequelize.query(sql, { replacements: allReplacements, type: QueryTypes.SELECT });
}

export async function adr(params: ReportParams, managerPropertyId?: string) {
  const gb = groupByExpr(params.groupBy || 'day');
  const { clauses, replacements } = scopeWhere(params, managerPropertyId);
  clauses.push("r.status IN ('checked_in','checked_out')");
  const where = 'WHERE ' + clauses.join(' AND ');

  return sequelize.query(
    `SELECT ${gb} as period, SUM(r.rate_cents) as total_revenue, COUNT(*) as occupied_nights,
     ROUND(SUM(r.rate_cents) / NULLIF(COUNT(*), 0), 2) as adr_cents
     FROM reservations r LEFT JOIN rooms rm ON r.room_id = rm.id ${where} GROUP BY period ORDER BY period`,
    { replacements, type: QueryTypes.SELECT }
  );
}

export async function revpar(params: ReportParams, managerPropertyId?: string) {
  const gb = groupByExpr(params.groupBy || 'day');
  const { clauses, replacements } = scopeWhere(params, managerPropertyId);
  clauses.push("r.status IN ('checked_in','checked_out')");
  const where = 'WHERE ' + clauses.join(' AND ');

  const rc = roomCountSubquery(managerPropertyId || params.propertyId);
  const allReplacements = [...rc.replacements, ...rc.replacements, ...replacements];

  return sequelize.query(
    `SELECT ${gb} as period, SUM(r.rate_cents) as total_revenue,
     ${rc.sql} as available_rooms,
     ROUND(SUM(r.rate_cents) / NULLIF(${rc.sql}, 0), 2) as revpar_cents
     FROM reservations r LEFT JOIN rooms rm ON r.room_id = rm.id ${where} GROUP BY period ORDER BY period`,
    { replacements: allReplacements, type: QueryTypes.SELECT }
  );
}

export async function revenueMix(params: ReportParams, managerPropertyId?: string) {
  const { clauses, replacements } = scopeWhere(params, managerPropertyId);
  clauses.push("r.status IN ('checked_in','checked_out')");
  const where = 'WHERE ' + clauses.join(' AND ');
  const groupCol = params.groupBy === 'room_type' ? 'rm.room_type' : 'r.channel';

  return sequelize.query(
    `SELECT ${groupCol} as category, SUM(r.rate_cents) as total_revenue, COUNT(*) as reservation_count
     FROM reservations r LEFT JOIN rooms rm ON r.room_id = rm.id ${where} GROUP BY category ORDER BY total_revenue DESC`,
    { replacements, type: QueryTypes.SELECT }
  );
}
