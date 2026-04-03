import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface FileAttributes {
  id: string; group_id: string | null; uploaded_by: string; original_name: string;
  mime_type: string; size_bytes: number; sha256: string; storage_path: string; created_at: Date;
}
export class FileRecord extends Model<FileAttributes, Optional<FileAttributes, 'group_id' | 'created_at'>> implements FileAttributes {
  public id!: string; public group_id!: string | null; public uploaded_by!: string;
  public original_name!: string; public mime_type!: string; public size_bytes!: number;
  public sha256!: string; public storage_path!: string; public created_at!: Date;
}
FileRecord.init({
  id: { type: DataTypes.STRING(36), primaryKey: true },
  group_id: { type: DataTypes.STRING(36), allowNull: true },
  uploaded_by: { type: DataTypes.STRING(36), allowNull: false },
  original_name: { type: DataTypes.STRING(255), allowNull: false },
  mime_type: { type: DataTypes.STRING(100), allowNull: false },
  size_bytes: { type: DataTypes.INTEGER, allowNull: false },
  sha256: { type: DataTypes.STRING(64), allowNull: false },
  storage_path: { type: DataTypes.STRING(500), allowNull: false },
  created_at: { type: DataTypes.DATE, allowNull: false },
}, { sequelize, tableName: 'files', timestamps: false, underscored: true });

export interface FileAccessLogAttributes {
  id: string; file_id: string; user_id: string; action: string; created_at: Date;
}
export class FileAccessLog extends Model<FileAccessLogAttributes, Optional<FileAccessLogAttributes, 'created_at'>> implements FileAccessLogAttributes {
  public id!: string; public file_id!: string; public user_id!: string; public action!: string; public created_at!: Date;
}
FileAccessLog.init({
  id: { type: DataTypes.STRING(36), primaryKey: true },
  file_id: { type: DataTypes.STRING(36), allowNull: false },
  user_id: { type: DataTypes.STRING(36), allowNull: false },
  action: { type: DataTypes.STRING(50), allowNull: false },
  created_at: { type: DataTypes.DATE, allowNull: false },
}, { sequelize, tableName: 'file_access_log', timestamps: false, underscored: true });
