import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export class Property extends Model {
  public id!: string; public name!: string; public address!: string | null;
  public created_at!: Date; public updated_at!: Date;
}
Property.init({
  id: { type: DataTypes.STRING(36), primaryKey: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  address: { type: DataTypes.TEXT, allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false },
  updated_at: { type: DataTypes.DATE, allowNull: false },
}, { sequelize, tableName: 'properties', timestamps: true, underscored: true, createdAt: 'created_at', updatedAt: 'updated_at' });

export class Room extends Model {
  public id!: string; public property_id!: string; public room_number!: string;
  public room_type!: string; public rate_cents!: number; public status!: string;
}
Room.init({
  id: { type: DataTypes.STRING(36), primaryKey: true },
  property_id: { type: DataTypes.STRING(36), allowNull: false },
  room_number: { type: DataTypes.STRING(20), allowNull: false },
  room_type: { type: DataTypes.STRING(100), allowNull: false },
  rate_cents: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM('available', 'occupied', 'maintenance'), allowNull: false, defaultValue: 'available' },
  created_at: { type: DataTypes.DATE, allowNull: false },
  updated_at: { type: DataTypes.DATE, allowNull: false },
}, { sequelize, tableName: 'rooms', timestamps: true, underscored: true, createdAt: 'created_at', updatedAt: 'updated_at' });

export class Reservation extends Model {
  public id!: string; public property_id!: string; public room_id!: string;
  public guest_name!: string; public channel!: string; public check_in_date!: string;
  public check_out_date!: string; public rate_cents!: number; public status!: string;
}
Reservation.init({
  id: { type: DataTypes.STRING(36), primaryKey: true },
  property_id: { type: DataTypes.STRING(36), allowNull: false },
  room_id: { type: DataTypes.STRING(36), allowNull: false },
  guest_name: { type: DataTypes.STRING(255), allowNull: false },
  channel: { type: DataTypes.STRING(100), allowNull: false },
  check_in_date: { type: DataTypes.DATEONLY, allowNull: false },
  check_out_date: { type: DataTypes.DATEONLY, allowNull: false },
  rate_cents: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM('confirmed', 'checked_in', 'checked_out', 'cancelled'), allowNull: false, defaultValue: 'confirmed' },
  created_at: { type: DataTypes.DATE, allowNull: false },
  updated_at: { type: DataTypes.DATE, allowNull: false },
}, { sequelize, tableName: 'reservations', timestamps: true, underscored: true, createdAt: 'created_at', updatedAt: 'updated_at' });

Property.hasMany(Room, { foreignKey: 'property_id' });
Property.hasMany(Reservation, { foreignKey: 'property_id' });
Room.hasMany(Reservation, { foreignKey: 'room_id' });
