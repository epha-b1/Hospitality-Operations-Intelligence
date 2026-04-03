import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

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

// Enforce immutability at app level — no UPDATE or DELETE via Sequelize ORM.
// The archive retention job uses raw SQL which bypasses these hooks intentionally.
// This is the documented maintenance boundary: only raw SQL with elevated context
// (the cron archive job) can remove rows older than 1 year.
AuditLog.beforeUpdate(() => { throw new Error('Audit logs are immutable — UPDATE is not allowed'); });
AuditLog.beforeDestroy(() => { throw new Error('Audit logs are immutable — DELETE is not allowed'); });
AuditLog.beforeBulkUpdate(() => { throw new Error('Audit logs are immutable — bulk UPDATE is not allowed'); });
AuditLog.beforeBulkDestroy(() => { throw new Error('Audit logs are immutable — bulk DELETE is not allowed'); });
