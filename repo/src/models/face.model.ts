import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class FaceEnrollmentSession extends Model {
  public id!: string; public user_id!: string; public status!: string;
  public angles_captured!: Record<string, unknown>; public expires_at!: Date;
}
FaceEnrollmentSession.init({
  id: { type: DataTypes.STRING(36), primaryKey: true },
  user_id: { type: DataTypes.STRING(36), allowNull: false },
  status: { type: DataTypes.ENUM('in_progress', 'completed', 'expired'), defaultValue: 'in_progress' },
  angles_captured: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  created_at: { type: DataTypes.DATE, allowNull: false },
  updated_at: { type: DataTypes.DATE, allowNull: false },
}, { sequelize, tableName: 'face_enrollment_sessions', timestamps: true, underscored: true, createdAt: 'created_at', updatedAt: 'updated_at' });

export class FaceEnrollment extends Model {
  public id!: string; public user_id!: string; public version!: number; public status!: string;
  public template_path!: string; public angles_captured!: Record<string, unknown>;
  public liveness_passed!: boolean; public liveness_meta!: Record<string, unknown> | null;
  public raw_image_path!: string | null; public raw_image_expires_at!: Date | null;
}
FaceEnrollment.init({
  id: { type: DataTypes.STRING(36), primaryKey: true },
  user_id: { type: DataTypes.STRING(36), allowNull: false },
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  status: { type: DataTypes.ENUM('active', 'deactivated'), defaultValue: 'active' },
  template_path: { type: DataTypes.STRING(500), allowNull: false },
  angles_captured: { type: DataTypes.JSON, allowNull: false },
  liveness_passed: { type: DataTypes.BOOLEAN, allowNull: false },
  liveness_meta: { type: DataTypes.JSON, allowNull: true },
  raw_image_path: { type: DataTypes.STRING(500), allowNull: true },
  raw_image_expires_at: { type: DataTypes.DATE, allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false },
  updated_at: { type: DataTypes.DATE, allowNull: false },
}, { sequelize, tableName: 'face_enrollments', timestamps: true, underscored: true, createdAt: 'created_at', updatedAt: 'updated_at' });
