import { v4 as uuidv4 } from 'uuid';
import { Notification } from '../models/notification.model';
import { createCategoryLogger } from '../utils/logger';

const logger = createCategoryLogger('system');

export async function emitNotification(params: {
  groupId: string;
  actorId: string;
  eventType: string;
  resourceType?: string;
  resourceId?: string;
  detail?: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<void> {
  try {
    await Notification.create({
      id: uuidv4(),
      group_id: params.groupId,
      actor_id: params.actorId,
      event_type: params.eventType,
      resource_type: params.resourceType || null,
      resource_id: params.resourceId || null,
      detail: params.detail || null,
      idempotency_key: params.idempotencyKey,
      created_at: new Date(),
    });
  } catch (err: unknown) {
    // Duplicate idempotency key — silently ignore per spec
    if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'SequelizeUniqueConstraintError') {
      logger.info('Duplicate notification idempotency key ignored', { key: params.idempotencyKey });
      return;
    }
    throw err;
  }
}
