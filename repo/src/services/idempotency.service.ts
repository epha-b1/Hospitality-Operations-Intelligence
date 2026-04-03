import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { DataTypes, Model, Op } from 'sequelize';
import { sequelize } from '../config/database';
import { AppError } from '../utils/errors';

export class IdempotencyKey extends Model {
  public id!: string;
  public key!: string;
  public actor_id!: string;
  public operation!: string;
  public resource_id!: string | null;
  public request_hash!: string;
  public response_snapshot!: unknown;
  public expires_at!: Date;
  public created_at!: Date;
}

IdempotencyKey.init({
  id: { type: DataTypes.STRING(36), primaryKey: true },
  key: { type: DataTypes.STRING(255), allowNull: false },
  actor_id: { type: DataTypes.STRING(36), allowNull: false },
  operation: { type: DataTypes.STRING(100), allowNull: false },
  resource_id: { type: DataTypes.STRING(255), allowNull: true },
  request_hash: { type: DataTypes.STRING(64), allowNull: false },
  response_snapshot: { type: DataTypes.JSON, allowNull: true },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  created_at: { type: DataTypes.DATE, allowNull: false },
}, { sequelize, tableName: 'idempotency_keys', timestamps: false, underscored: true });

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function hashBody(body: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(body || {})).digest('hex');
}

/**
 * Check idempotency for an update operation.
 * Returns stored response if key exists with same hash, or null to proceed.
 * Throws 409 if key exists with different hash.
 */
export async function checkIdempotency(
  key: string, actorId: string, operation: string, body: unknown
): Promise<unknown | null> {
  // Scoped to (key, actor, operation) — same key can be reused across different operations
  const existing = await IdempotencyKey.findOne({ where: { key, actor_id: actorId, operation } });
  if (!existing) return null; // proceed

  if (new Date(existing.expires_at) < new Date()) {
    // Expired — delete and proceed
    await IdempotencyKey.destroy({ where: { id: existing.id } });
    return null;
  }

  const reqHash = hashBody(body);
  if (existing.request_hash === reqHash) {
    // Same request — return stored response (replay)
    return existing.response_snapshot;
  }

  // Different body with same key — conflict
  throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key already used with a different request');
}

/**
 * Store the response for an idempotent operation.
 */
export async function storeIdempotency(
  key: string, actorId: string, operation: string, resourceId: string | null, body: unknown, response: unknown
): Promise<void> {
  await IdempotencyKey.create({
    id: uuidv4(), key, actor_id: actorId, operation,
    resource_id: resourceId,
    request_hash: hashBody(body),
    response_snapshot: response,
    expires_at: new Date(Date.now() + TTL_MS),
    created_at: new Date(),
  });
}
