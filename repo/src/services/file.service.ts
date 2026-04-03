import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FileRecord, FileAccessLog } from '../models/file.model';
import { GroupMember } from '../models/group.model';
import { AppError, ErrorCodes } from '../utils/errors';
import { emitNotification } from './notification.service';

const ALLOWED_MIMES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

async function assertMember(groupId: string, userId: string) {
  const m = await GroupMember.findOne({ where: { group_id: groupId, user_id: userId } });
  if (!m) throw new AppError(403, 'FORBIDDEN', 'Not a member of this group');
  return m;
}

async function assertOwnerOrAdmin(groupId: string, userId: string) {
  const m = await assertMember(groupId, userId);
  if (m.role !== 'owner' && m.role !== 'admin')
    throw new AppError(403, 'FORBIDDEN', 'Owner or admin role required');
}

export async function uploadFile(groupId: string, userId: string, file: Express.Multer.File) {
  await assertMember(groupId, userId);

  if (!ALLOWED_MIMES.includes(file.mimetype))
    throw new AppError(400, 'MIME_NOT_ALLOWED', `MIME type ${file.mimetype} not allowed`);
  if (file.size > MAX_SIZE)
    throw new AppError(400, 'FILE_TOO_LARGE', `File exceeds ${MAX_SIZE / 1024 / 1024} MB limit`);

  const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');

  // Dedup per-group
  const existing = await FileRecord.findOne({ where: { sha256: hash, group_id: groupId } });
  if (existing) return existing;

  const fileId = uuidv4();
  const ext = path.extname(file.originalname);
  const storageName = `${fileId}${ext}`;
  const storagePath = path.join('uploads', storageName);

  fs.writeFileSync(path.resolve(storagePath), file.buffer);

  const record = await FileRecord.create({
    id: fileId, group_id: groupId, uploaded_by: userId,
    original_name: file.originalname, mime_type: file.mimetype,
    size_bytes: file.size, sha256: hash, storage_path: storagePath,
    created_at: new Date(),
  });

  await emitNotification({
    groupId, actorId: userId, eventType: 'file_uploaded',
    resourceType: 'file', resourceId: fileId,
    detail: { fileName: file.originalname },
    idempotencyKey: `file_uploaded:${fileId}`,
  });

  return record;
}

export async function listFiles(groupId: string, userId: string) {
  await assertMember(groupId, userId);
  return FileRecord.findAll({ where: { group_id: groupId }, order: [['created_at', 'DESC']] });
}

export async function downloadFile(groupId: string, fileId: string, userId: string) {
  await assertMember(groupId, userId);
  const file = await FileRecord.findOne({ where: { id: fileId, group_id: groupId } });
  if (!file) throw new AppError(404, 'NOT_FOUND', 'File not found');

  await FileAccessLog.create({ id: uuidv4(), file_id: fileId, user_id: userId, action: 'read', created_at: new Date() });
  return file;
}

export async function deleteFile(groupId: string, fileId: string, userId: string) {
  await assertOwnerOrAdmin(groupId, userId);
  const file = await FileRecord.findOne({ where: { id: fileId, group_id: groupId } });
  if (!file) throw new AppError(404, 'NOT_FOUND', 'File not found');

  await FileAccessLog.create({ id: uuidv4(), file_id: fileId, user_id: userId, action: 'delete', created_at: new Date() });
  try { fs.unlinkSync(path.resolve(file.storage_path)); } catch { /* file may already be gone */ }
  await FileRecord.destroy({ where: { id: fileId } });

  await emitNotification({
    groupId, actorId: userId, eventType: 'file_deleted',
    resourceType: 'file', resourceId: fileId,
    detail: { fileName: file.original_name },
    idempotencyKey: `file_deleted:${fileId}:${Date.now()}`,
  });
}
