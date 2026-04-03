import { Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { Notification } from '../models/notification.model';
import { GroupMember } from '../models/group.model';
import { AppError } from '../utils/errors';
import { sequelize } from '../config/database';

export async function queryNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const groupId = req.query.groupId as string;
    if (!groupId) throw new AppError(400, 'VALIDATION_ERROR', 'groupId is required');

    const member = await GroupMember.findOne({ where: { group_id: groupId, user_id: req.user!.id } });
    if (!member) throw new AppError(403, 'FORBIDDEN', 'Not a member of this group');

    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const afterCursor = req.query.after as string | undefined;

    const whereClause: any = { group_id: groupId };

    if (afterCursor) {
      // Support after=<notificationId> (UUID) — look up that notification's created_at for stable ordering
      const anchor = await Notification.findByPk(afterCursor);
      if (anchor) {
        whereClause[Op.or] = [
          { created_at: { [Op.gt]: anchor.created_at } },
          { created_at: anchor.created_at, id: { [Op.gt]: anchor.id } },
        ];
      } else {
        // Fallback: try base64 JSON cursor for backwards compat
        try {
          const decoded = JSON.parse(Buffer.from(afterCursor, 'base64').toString('utf8'));
          whereClause[Op.or] = [
            { created_at: { [Op.gt]: decoded.createdAt } },
            { created_at: decoded.createdAt, id: { [Op.gt]: decoded.id } },
          ];
        } catch {
          throw new AppError(400, 'VALIDATION_ERROR', 'Invalid cursor');
        }
      }
    }

    const notifications = await Notification.findAll({
      where: whereClause,
      order: [['created_at', 'ASC'], ['id', 'ASC']],
      limit,
    });

    let nextCursor: string | null = null;
    if (notifications.length === limit) {
      const last = notifications[notifications.length - 1];
      // Opaque base64 cursor: {createdAt, id} — stable under concurrent inserts
      nextCursor = Buffer.from(JSON.stringify({ createdAt: last.created_at, id: last.id })).toString('base64');
    }

    res.json({ data: notifications, nextCursor });
  } catch (e) { next(e); }
}

export async function markRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const notif = await Notification.findByPk(req.params.id);
    if (!notif) throw new AppError(404, 'NOT_FOUND', 'Notification not found');

    const member = await GroupMember.findOne({ where: { group_id: notif.group_id, user_id: req.user!.id } });
    if (!member) throw new AppError(403, 'FORBIDDEN', 'Not a member of this group');

    await sequelize.query(
      'INSERT IGNORE INTO notification_reads (notification_id, user_id, read_at) VALUES (?, ?, NOW())',
      { replacements: [req.params.id, req.user!.id] }
    );
    res.json({ message: 'Marked as read' });
  } catch (e) { next(e); }
}
