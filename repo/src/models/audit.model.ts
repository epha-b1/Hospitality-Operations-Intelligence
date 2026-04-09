import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { AppError } from '../utils/errors';

export class AuditLog extends Model {
  public id!: string; public actor_id!: string | null; public action!: string;
  public resource_type!: string | null; public resource_id!: string | null;
  public detail!: Record<string, unknown> | null; public trace_id!: string | null;
  public ip_address!: string | null; public created_at!: Date;
}
AuditLog.init({
  id: { type: DataTypes.STRING(36), primaryKey: true },
  actor_id: { type: DataTypes.STRING(36), allowNull: true },
  action: { type: DataTypes.STRING(255), allowNull: false },
  resource_type: { type: DataTypes.STRING(100), allowNull: true },
  resource_id: { type: DataTypes.STRING(36), allowNull: true },
  detail: { type: DataTypes.JSON, allowNull: true },
  trace_id: { type: DataTypes.STRING(36), allowNull: true },
  ip_address: { type: DataTypes.STRING(45), allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false },
}, { sequelize, tableName: 'audit_logs', timestamps: false, underscored: true });

// ---------------------------------------------------------------------------
// Immutability enforcement
// ---------------------------------------------------------------------------
// Three layers defend the "1-year immutable audit log" requirement:
//
//   1) Sequelize lifecycle hooks (below) reject every UPDATE/DELETE attempt
//      that goes through the ORM, including bulk operations and instance
//      methods (`save`, `update`, `destroy`). This is the "normal path"
//      guarantee — any business code that accidentally calls an update or
//      delete will fail loudly before SQL is ever emitted.
//
//   2) DB-level triggers installed by migration 017-audit-logs-immutability.js
//      reject UPDATE and DELETE statements regardless of source, so even
//      raw SQL executed through the same credential cannot mutate
//      historical rows.
//
//   3) Production DB role grants (documented in docs/audit-immutability.md)
//      REVOKE UPDATE and DELETE from the application user on audit_logs,
//      leaving only a dedicated maintenance role able to run the archival
//      job.
//
// Throwing AppError (not plain Error) lets the global error handler render
// a structured 500 response rather than leaking a stack trace.

const immutabilityError = (op: string): AppError =>
  new AppError(500, 'AUDIT_IMMUTABLE', `Audit logs are immutable — ${op} is not allowed`);

AuditLog.beforeUpdate(() => { throw immutabilityError('UPDATE'); });
AuditLog.beforeDestroy(() => { throw immutabilityError('DELETE'); });
AuditLog.beforeBulkUpdate(() => { throw immutabilityError('bulk UPDATE'); });
AuditLog.beforeBulkDestroy(() => { throw immutabilityError('bulk DELETE'); });
AuditLog.beforeSave((instance: AuditLog) => {
  // A no-op save on an existing row would bypass beforeUpdate in some
  // sequelize versions — defensively reject any save that is not a create.
  if (!instance.isNewRecord) throw immutabilityError('SAVE');
});
