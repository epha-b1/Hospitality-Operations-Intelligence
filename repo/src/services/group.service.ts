import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Group, GroupMember, GroupRequiredField, MemberFieldValue } from '../models/group.model';
import { User } from '../models/user.model';
import { AppError, ErrorCodes } from '../utils/errors';
import { emitNotification } from './notification.service';
import { createCategoryLogger } from '../utils/logger';

const logger = createCategoryLogger('system');

const US_PHONE_REGEX = /^\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})$/;

function generateJoinCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// --- Group CRUD ---

export async function createGroup(userId: string, name: string) {
  const joinCode = generateJoinCode();
  const groupId = uuidv4();

  const group = await Group.create({ id: groupId, name, owner_id: userId, join_code: joinCode });

  await GroupMember.create({
    id: uuidv4(),
    group_id: groupId,
    user_id: userId,
    role: 'owner',
    joined_at: new Date(),
  });

  return group;
}

export async function listGroups(userId: string) {
  const memberships = await GroupMember.findAll({ where: { user_id: userId } });
  const groupIds = memberships.map((m) => m.group_id);
  if (groupIds.length === 0) return [];
  return Group.findAll({ where: { id: groupIds }, order: [['created_at', 'DESC']] });
}

export async function getGroup(groupId: string, userId: string) {
  const group = await Group.findByPk(groupId);
  if (!group) throw new AppError(ErrorCodes.NOT_FOUND.statusCode, ErrorCodes.NOT_FOUND.code, 'Group not found');
  await assertMember(groupId, userId);
  return group;
}

export async function updateGroup(groupId: string, userId: string, data: { name?: string; status?: 'active' | 'archived' }) {
  await assertOwnerOrAdmin(groupId, userId);
  const group = await Group.findByPk(groupId);
  if (!group) throw new AppError(ErrorCodes.NOT_FOUND.statusCode, ErrorCodes.NOT_FOUND.code, 'Group not found');
  await Group.update(data, { where: { id: groupId } });
  return Group.findByPk(groupId);
}

// --- Join ---

export async function joinGroup(userId: string, joinCode: string) {
  const group = await Group.findOne({ where: { join_code: joinCode } });
  if (!group || group.status !== 'active') {
    throw new AppError(ErrorCodes.NOT_FOUND.statusCode, ErrorCodes.NOT_FOUND.code, 'Invalid join code');
  }

  const existing = await GroupMember.findOne({ where: { group_id: group.id, user_id: userId } });
  if (existing) {
    throw new AppError(ErrorCodes.CONFLICT.statusCode, ErrorCodes.CONFLICT.code, 'Already a member');
  }

  await GroupMember.create({
    id: uuidv4(),
    group_id: group.id,
    user_id: userId,
    role: 'member',
    joined_at: new Date(),
  });

  await emitNotification({
    groupId: group.id,
    actorId: userId,
    eventType: 'member_joined',
    resourceType: 'group',
    resourceId: group.id,
    detail: { userId },
    idempotencyKey: `member_joined:${group.id}:${userId}`,
  });

  return group;
}

// --- Members ---

export async function listMembers(groupId: string, userId: string) {
  await assertMember(groupId, userId);
  const members = await GroupMember.findAll({ where: { group_id: groupId } });
  const userIds = members.map((m) => m.user_id);
  const users = await User.findAll({
    where: { id: userIds },
    attributes: ['id', 'username', 'legal_name'],
  });
  const userMap = new Map(users.map((u) => [u.id, u]));
  return members.map((m) => ({
    id: m.id,
    userId: m.user_id,
    role: m.role,
    joinedAt: m.joined_at,
    username: userMap.get(m.user_id)?.username,
    legalName: userMap.get(m.user_id)?.legal_name,
  }));
}

export async function removeMember(groupId: string, actorId: string, targetUserId: string) {
  await assertOwnerOrAdmin(groupId, actorId);

  const membership = await GroupMember.findOne({ where: { group_id: groupId, user_id: targetUserId } });
  if (!membership) throw new AppError(ErrorCodes.NOT_FOUND.statusCode, ErrorCodes.NOT_FOUND.code, 'Member not found');

  if (membership.role === 'owner') {
    throw new AppError(ErrorCodes.CONFLICT.statusCode, ErrorCodes.CONFLICT.code, 'Cannot remove the group owner');
  }

  await GroupMember.destroy({ where: { id: membership.id } });

  await emitNotification({
    groupId,
    actorId,
    eventType: 'member_removed',
    resourceType: 'group',
    resourceId: groupId,
    detail: { removedUserId: targetUserId },
    idempotencyKey: `member_removed:${groupId}:${targetUserId}:${Date.now()}`,
  });
}

// --- Required Fields ---

export async function listRequiredFields(groupId: string, userId: string) {
  await assertMember(groupId, userId);
  return GroupRequiredField.findAll({ where: { group_id: groupId }, order: [['created_at', 'ASC']] });
}

export async function addRequiredField(groupId: string, userId: string, data: { fieldName: string; fieldType: string; isRequired?: boolean }) {
  await assertOwnerOrAdmin(groupId, userId);
  const field = await GroupRequiredField.create({
    id: uuidv4(),
    group_id: groupId,
    field_name: data.fieldName,
    field_type: data.fieldType,
    is_required: data.isRequired !== undefined ? data.isRequired : true,
    created_at: new Date(),
  });

  await emitNotification({
    groupId,
    actorId: userId,
    eventType: 'field_config_changed',
    resourceType: 'group_required_field',
    resourceId: field.id,
    detail: { action: 'added', fieldName: data.fieldName },
    idempotencyKey: `field_added:${groupId}:${field.id}`,
  });

  return field;
}

export async function updateRequiredField(groupId: string, userId: string, fieldId: string, data: { isRequired?: boolean }) {
  await assertOwnerOrAdmin(groupId, userId);
  const field = await GroupRequiredField.findOne({ where: { id: fieldId, group_id: groupId } });
  if (!field) throw new AppError(ErrorCodes.NOT_FOUND.statusCode, ErrorCodes.NOT_FOUND.code, 'Field config not found');

  if (data.isRequired !== undefined) {
    await GroupRequiredField.update({ is_required: data.isRequired }, { where: { id: fieldId } });
  }

  return GroupRequiredField.findByPk(fieldId);
}

export async function deleteRequiredField(groupId: string, userId: string, fieldId: string) {
  await assertOwnerOrAdmin(groupId, userId);
  const field = await GroupRequiredField.findOne({ where: { id: fieldId, group_id: groupId } });
  if (!field) throw new AppError(ErrorCodes.NOT_FOUND.statusCode, ErrorCodes.NOT_FOUND.code, 'Field config not found');
  await GroupRequiredField.destroy({ where: { id: fieldId } });

  await emitNotification({
    groupId,
    actorId: userId,
    eventType: 'field_config_changed',
    resourceType: 'group_required_field',
    resourceId: fieldId,
    detail: { action: 'removed', fieldName: field.field_name },
    idempotencyKey: `field_removed:${groupId}:${fieldId}:${Date.now()}`,
  });
}

// --- Member Field Values ---

export async function getMyFields(groupId: string, userId: string) {
  await assertMember(groupId, userId);
  return MemberFieldValue.findAll({ where: { group_id: groupId, user_id: userId } });
}

export async function submitMyFields(groupId: string, userId: string, fields: Record<string, string>) {
  await assertMember(groupId, userId);

  // Validate phone-type fields
  const requiredFields = await GroupRequiredField.findAll({ where: { group_id: groupId } });
  const phoneFields = requiredFields.filter((f) => f.field_type === 'phone').map((f) => f.field_name);

  for (const [fieldName, value] of Object.entries(fields)) {
    if (phoneFields.includes(fieldName) && !US_PHONE_REGEX.test(value)) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR.statusCode,
        ErrorCodes.VALIDATION_ERROR.code,
        `Invalid US phone format for field '${fieldName}'`
      );
    }
  }

  const results = [];
  for (const [fieldName, value] of Object.entries(fields)) {
    const existing = await MemberFieldValue.findOne({
      where: { group_id: groupId, user_id: userId, field_name: fieldName },
    });

    if (existing) {
      await MemberFieldValue.update({ value }, { where: { id: existing.id } });
      results.push({ ...existing.toJSON(), value });
    } else {
      const created = await MemberFieldValue.create({
        id: uuidv4(),
        group_id: groupId,
        user_id: userId,
        field_name: fieldName,
        value,
      });
      results.push(created);
    }
  }

  return results;
}

// --- Helpers ---

async function assertMember(groupId: string, userId: string): Promise<GroupMember> {
  const membership = await GroupMember.findOne({ where: { group_id: groupId, user_id: userId } });
  if (!membership) {
    throw new AppError(ErrorCodes.FORBIDDEN.statusCode, ErrorCodes.FORBIDDEN.code, 'Not a member of this group');
  }
  return membership;
}

async function assertOwnerOrAdmin(groupId: string, userId: string): Promise<GroupMember> {
  const membership = await assertMember(groupId, userId);
  if (membership.role !== 'owner' && membership.role !== 'admin') {
    throw new AppError(ErrorCodes.FORBIDDEN.statusCode, ErrorCodes.FORBIDDEN.code, 'Owner or admin role required');
  }
  return membership;
}
