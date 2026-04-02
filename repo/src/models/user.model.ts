import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface UserAttributes {
  id: string;
  username: string;
  password_hash: string;
  role: 'hotel_admin' | 'manager' | 'analyst' | 'member';
  property_id: string | null;
  legal_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  tax_invoice_title: string | null;
  preferred_currency: string | null;
  pii_export_allowed: boolean;
  status: 'active' | 'suspended' | 'deleted';
  failed_attempts: number;
  locked_until: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface UserCreationAttributes
  extends Optional<
    UserAttributes,
    | 'property_id'
    | 'legal_name'
    | 'address_line1'
    | 'address_line2'
    | 'city'
    | 'state'
    | 'zip'
    | 'tax_invoice_title'
    | 'preferred_currency'
    | 'pii_export_allowed'
    | 'status'
    | 'failed_attempts'
    | 'locked_until'
    | 'created_at'
    | 'updated_at'
    | 'deleted_at'
  > {}

export class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  public id!: string;
  public username!: string;
  public password_hash!: string;
  public role!: 'hotel_admin' | 'manager' | 'analyst' | 'member';
  public property_id!: string | null;
  public legal_name!: string | null;
  public address_line1!: string | null;
  public address_line2!: string | null;
  public city!: string | null;
  public state!: string | null;
  public zip!: string | null;
  public tax_invoice_title!: string | null;
  public preferred_currency!: string | null;
  public pii_export_allowed!: boolean;
  public status!: 'active' | 'suspended' | 'deleted';
  public failed_attempts!: number;
  public locked_until!: Date | null;
  public created_at!: Date;
  public updated_at!: Date;
  public deleted_at!: Date | null;
}

User.init(
  {
    id: {
      type: DataTypes.STRING(36),
      primaryKey: true,
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('hotel_admin', 'manager', 'analyst', 'member'),
      allowNull: false,
      defaultValue: 'member',
    },
    property_id: {
      type: DataTypes.STRING(36),
      allowNull: true,
    },
    legal_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    address_line1: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    address_line2: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    state: {
      type: DataTypes.STRING(2),
      allowNull: true,
    },
    zip: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    tax_invoice_title: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    preferred_currency: {
      type: DataTypes.STRING(3),
      allowNull: true,
      defaultValue: 'USD',
    },
    pii_export_allowed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    status: {
      type: DataTypes.ENUM('active', 'suspended', 'deleted'),
      allowNull: false,
      defaultValue: 'active',
    },
    failed_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: true,
    paranoid: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  }
);
