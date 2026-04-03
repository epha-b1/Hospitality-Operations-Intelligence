import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class QualityCheck extends Model {
  public id!: string; public entity_type!: string; public check_type!: string;
  public config!: Record<string, unknown>; public result!: Record<string, unknown> | null;
  public passed!: boolean | null; public run_at!: Date | null; public trace_id!: string | null;
}
QualityCheck.init({
  id: { type: DataTypes.STRING(36), primaryKey: true },
  entity_type: { type: DataTypes.STRING(100), allowNull: false },
  check_type: { type: DataTypes.STRING(100), allowNull: false },
  config: { type: DataTypes.JSON, allowNull: false },
  result: { type: DataTypes.JSON, allowNull: true },
  passed: { type: DataTypes.BOOLEAN, allowNull: true },
  run_at: { type: DataTypes.DATE, allowNull: true },
  trace_id: { type: DataTypes.STRING(36), allowNull: true },
}, { sequelize, tableName: 'quality_checks', timestamps: false, underscored: true });

export class OperationalMetric extends Model {
  public id!: string; public metric_name!: string; public metric_value!: number;
  public labels!: Record<string, unknown> | null; public trace_id!: string | null; public recorded_at!: Date;
}
OperationalMetric.init({
  id: { type: DataTypes.STRING(36), primaryKey: true },
  metric_name: { type: DataTypes.STRING(255), allowNull: false },
  metric_value: { type: DataTypes.DECIMAL(15, 4), allowNull: false },
  labels: { type: DataTypes.JSON, allowNull: true },
  trace_id: { type: DataTypes.STRING(36), allowNull: true },
  recorded_at: { type: DataTypes.DATE, allowNull: false },
}, { sequelize, tableName: 'operational_metrics', timestamps: false, underscored: true });
