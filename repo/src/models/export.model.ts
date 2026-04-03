import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class ExportRecord extends Model {
  public id!: string;
  public user_id!: string;
  public filename!: string;
  public export_type!: string;
  public expires_at!: Date;
  public created_at!: Date;
}

ExportRecord.init({
  id: { type: DataTypes.STRING(36), primaryKey: true },
  user_id: { type: DataTypes.STRING(36), allowNull: false },
  filename: { type: DataTypes.STRING(500), allowNull: false, unique: true },
  export_type: { type: DataTypes.STRING(50), allowNull: false },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  created_at: { type: DataTypes.DATE, allowNull: false },
}, { sequelize, tableName: 'export_records', timestamps: false, underscored: true });
