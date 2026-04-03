import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export class ImportBatch extends Model {
  public id!: string; public user_id!: string; public batch_type!: string; public status!: string;
  public total_rows!: number; public success_rows!: number; public error_rows!: number;
  public trace_id!: string | null; public created_at!: Date; public completed_at!: Date | null;
}
ImportBatch.init({
  id: { type: DataTypes.STRING(36), primaryKey: true },
  user_id: { type: DataTypes.STRING(36), allowNull: false },
  batch_type: { type: DataTypes.STRING(50), allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'), defaultValue: 'pending' },
  total_rows: { type: DataTypes.INTEGER, defaultValue: 0 },
  success_rows: { type: DataTypes.INTEGER, defaultValue: 0 },
  error_rows: { type: DataTypes.INTEGER, defaultValue: 0 },
  trace_id: { type: DataTypes.STRING(36), allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false },
  completed_at: { type: DataTypes.DATE, allowNull: true },
}, { sequelize, tableName: 'import_batches', timestamps: false, underscored: true });

export class ImportError extends Model {
  public id!: string; public batch_id!: string; public row_number!: number;
  public field!: string | null; public reason!: string; public raw_data!: unknown;
}
ImportError.init({
  id: { type: DataTypes.STRING(36), primaryKey: true },
  batch_id: { type: DataTypes.STRING(36), allowNull: false },
  row_number: { type: DataTypes.INTEGER, allowNull: false },
  field: { type: DataTypes.STRING(255), allowNull: true },
  reason: { type: DataTypes.TEXT, allowNull: false },
  raw_data: { type: DataTypes.JSON, allowNull: true },
}, { sequelize, tableName: 'import_errors', timestamps: false, underscored: true });

export class StaffingRecord extends Model {
  public id!: string; public batch_id!: string; public employee_id!: string;
  public effective_date!: string; public position!: string; public department!: string | null;
  public property_id!: string | null; public signed_off_by!: string | null;
}
StaffingRecord.init({
  id: { type: DataTypes.STRING(36), primaryKey: true },
  batch_id: { type: DataTypes.STRING(36), allowNull: false },
  employee_id: { type: DataTypes.STRING(100), allowNull: false },
  effective_date: { type: DataTypes.DATEONLY, allowNull: false },
  position: { type: DataTypes.STRING(255), allowNull: false },
  department: { type: DataTypes.STRING(255), allowNull: true },
  property_id: { type: DataTypes.STRING(36), allowNull: true },
  signed_off_by: { type: DataTypes.STRING(255), allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false },
}, { sequelize, tableName: 'staffing_records', timestamps: false, underscored: true });

export class EvaluationRecord extends Model {
  public id!: string; public batch_id!: string; public employee_id!: string;
  public effective_date!: string; public score!: number | null; public result!: string | null;
  public rewards!: string | null; public penalties!: string | null; public signed_off_by!: string | null;
}
EvaluationRecord.init({
  id: { type: DataTypes.STRING(36), primaryKey: true },
  batch_id: { type: DataTypes.STRING(36), allowNull: false },
  employee_id: { type: DataTypes.STRING(100), allowNull: false },
  effective_date: { type: DataTypes.DATEONLY, allowNull: false },
  score: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
  result: { type: DataTypes.STRING(100), allowNull: true },
  rewards: { type: DataTypes.TEXT, allowNull: true },
  penalties: { type: DataTypes.TEXT, allowNull: true },
  signed_off_by: { type: DataTypes.STRING(255), allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false },
}, { sequelize, tableName: 'evaluation_records', timestamps: false, underscored: true });

ImportBatch.hasMany(ImportError, { foreignKey: 'batch_id', as: 'errors' });
ImportBatch.hasMany(StaffingRecord, { foreignKey: 'batch_id', as: 'staffingRecords' });
ImportBatch.hasMany(EvaluationRecord, { foreignKey: 'batch_id', as: 'evaluationRecords' });
