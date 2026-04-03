import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface GroupAttributes {
  id: string;
  name: string;
  owner_id: string;
  join_code: string;
  status: 'active' | 'archived';
  created_at: Date;
  updated_at: Date;
}

export interface GroupCreationAttributes extends Optional<GroupAttributes, 'status' | 'created_at' | 'updated_at'> {}

export class Group extends Model<GroupAttributes, GroupCreationAttributes> implements GroupAttributes {
  public id!: string;
  public name!: string;
  public owner_id!: string;
  public join_code!: string;
  public status!: 'active' | 'archived';
  public created_at!: Date;
  public updated_at!: Date;
}

Group.init(
  {
    id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    owner_id: { type: DataTypes.STRING(36), allowNull: false },
    join_code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    status: { type: DataTypes.ENUM('active', 'archived'), allowNull: false, defaultValue: 'active' },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  { sequelize, tableName: 'groups', timestamps: true, underscored: true, createdAt: 'created_at', updatedAt: 'updated_at' }
);

export interface GroupMemberAttributes {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: Date;
}

export interface GroupMemberCreationAttributes extends Optional<GroupMemberAttributes, 'role' | 'joined_at'> {}

export class GroupMember extends Model<GroupMemberAttributes, GroupMemberCreationAttributes> implements GroupMemberAttributes {
  public id!: string;
  public group_id!: string;
  public user_id!: string;
  public role!: 'owner' | 'admin' | 'member';
  public joined_at!: Date;
}

GroupMember.init(
  {
    id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false },
    group_id: { type: DataTypes.STRING(36), allowNull: false },
    user_id: { type: DataTypes.STRING(36), allowNull: false },
    role: { type: DataTypes.ENUM('owner', 'admin', 'member'), allowNull: false, defaultValue: 'member' },
    joined_at: { type: DataTypes.DATE, allowNull: false },
  },
  { sequelize, tableName: 'group_members', timestamps: false, underscored: true }
);

export interface GroupRequiredFieldAttributes {
  id: string;
  group_id: string;
  field_name: string;
  field_type: string;
  is_required: boolean;
  created_at: Date;
}

export interface GroupRequiredFieldCreationAttributes extends Optional<GroupRequiredFieldAttributes, 'is_required' | 'created_at'> {}

export class GroupRequiredField extends Model<GroupRequiredFieldAttributes, GroupRequiredFieldCreationAttributes> implements GroupRequiredFieldAttributes {
  public id!: string;
  public group_id!: string;
  public field_name!: string;
  public field_type!: string;
  public is_required!: boolean;
  public created_at!: Date;
}

GroupRequiredField.init(
  {
    id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false },
    group_id: { type: DataTypes.STRING(36), allowNull: false },
    field_name: { type: DataTypes.STRING(100), allowNull: false },
    field_type: { type: DataTypes.STRING(50), allowNull: false },
    is_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
  },
  { sequelize, tableName: 'group_required_fields', timestamps: false, underscored: true }
);

export interface MemberFieldValueAttributes {
  id: string;
  group_id: string;
  user_id: string;
  field_name: string;
  value: string;
  created_at: Date;
  updated_at: Date;
}

export interface MemberFieldValueCreationAttributes extends Optional<MemberFieldValueAttributes, 'created_at' | 'updated_at'> {}

export class MemberFieldValue extends Model<MemberFieldValueAttributes, MemberFieldValueCreationAttributes> implements MemberFieldValueAttributes {
  public id!: string;
  public group_id!: string;
  public user_id!: string;
  public field_name!: string;
  public value!: string;
  public created_at!: Date;
  public updated_at!: Date;
}

MemberFieldValue.init(
  {
    id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false },
    group_id: { type: DataTypes.STRING(36), allowNull: false },
    user_id: { type: DataTypes.STRING(36), allowNull: false },
    field_name: { type: DataTypes.STRING(100), allowNull: false },
    value: { type: DataTypes.TEXT, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  { sequelize, tableName: 'member_field_values', timestamps: true, underscored: true, createdAt: 'created_at', updatedAt: 'updated_at' }
);

// Associations
Group.hasMany(GroupMember, { foreignKey: 'group_id', as: 'members' });
GroupMember.belongsTo(Group, { foreignKey: 'group_id' });
Group.hasMany(GroupRequiredField, { foreignKey: 'group_id', as: 'requiredFields' });
Group.hasMany(MemberFieldValue, { foreignKey: 'group_id', as: 'fieldValues' });
