import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface ActivityLogAttributes {
  id: string;
  user_id: string;
  action: string;
  detail: Record<string, unknown> | null;
  trace_id: string | null;
  created_at: Date;
}

export interface ActivityLogCreationAttributes
  extends Optional<ActivityLogAttributes, 'detail' | 'trace_id' | 'created_at'> {}

export class ActivityLog
  extends Model<ActivityLogAttributes, ActivityLogCreationAttributes>
  implements ActivityLogAttributes
{
  public id!: string;
  public user_id!: string;
  public action!: string;
  public detail!: Record<string, unknown> | null;
  public trace_id!: string | null;
  public created_at!: Date;
}

ActivityLog.init(
  {
    id: {
      type: DataTypes.STRING(36),
      primaryKey: true,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.STRING(36),
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    action: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    detail: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    trace_id: {
      type: DataTypes.STRING(36),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'activity_logs',
    timestamps: false,
    underscored: true,
  }
);
