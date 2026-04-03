import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface NotificationAttributes {
  id: string;
  group_id: string;
  actor_id: string;
  event_type: string;
  resource_type: string | null;
  resource_id: string | null;
  detail: Record<string, unknown> | null;
  idempotency_key: string;
  created_at: Date;
}

export interface NotificationCreationAttributes extends Optional<NotificationAttributes, 'resource_type' | 'resource_id' | 'detail' | 'created_at'> {}

export class Notification extends Model<NotificationAttributes, NotificationCreationAttributes> implements NotificationAttributes {
  public id!: string;
  public group_id!: string;
  public actor_id!: string;
  public event_type!: string;
  public resource_type!: string | null;
  public resource_id!: string | null;
  public detail!: Record<string, unknown> | null;
  public idempotency_key!: string;
  public created_at!: Date;
}

Notification.init(
  {
    id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false },
    group_id: { type: DataTypes.STRING(36), allowNull: false },
    actor_id: { type: DataTypes.STRING(36), allowNull: false },
    event_type: { type: DataTypes.STRING(100), allowNull: false },
    resource_type: { type: DataTypes.STRING(100), allowNull: true },
    resource_id: { type: DataTypes.STRING(36), allowNull: true },
    detail: { type: DataTypes.JSON, allowNull: true },
    idempotency_key: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
  },
  { sequelize, tableName: 'notifications', timestamps: false, underscored: true }
);
