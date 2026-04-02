import { Response, NextFunction } from 'express';
import { User } from '../models/user.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { AppError, ErrorCodes } from '../utils/errors';

export async function listUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const { count, rows } = await User.findAndCountAll({
      attributes: { exclude: ['password_hash'] },
      order: [['created_at', 'DESC']],
      limit,
      offset,
      paranoid: false,
    });

    res.status(200).json({
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password_hash'] },
      paranoid: false,
    });

    if (!user) {
      throw new AppError(ErrorCodes.NOT_FOUND.statusCode, ErrorCodes.NOT_FOUND.code, 'User not found');
    }

    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await User.findByPk(req.params.id, { paranoid: false });
    if (!user) {
      throw new AppError(ErrorCodes.NOT_FOUND.statusCode, ErrorCodes.NOT_FOUND.code, 'User not found');
    }

    const allowedFields: Record<string, string> = {
      role: 'role',
      status: 'status',
      propertyId: 'property_id',
      piiExportAllowed: 'pii_export_allowed',
    };

    const data: Record<string, unknown> = {};
    for (const [camel, snake] of Object.entries(allowedFields)) {
      if (req.body[camel] !== undefined) {
        data[snake] = req.body[camel];
      }
    }

    // If status changes to 'deleted', set deleted_at
    if (data.status === 'deleted' && user.status !== 'deleted') {
      data.deleted_at = new Date();
    }
    // If status changes from 'deleted' to something else, clear deleted_at
    if (data.status && data.status !== 'deleted' && user.status === 'deleted') {
      data.deleted_at = null;
    }

    await User.update(data, { where: { id: req.params.id }, paranoid: false });

    const updated = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password_hash'] },
      paranoid: false,
    });

    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      throw new AppError(ErrorCodes.NOT_FOUND.statusCode, ErrorCodes.NOT_FOUND.code, 'User not found');
    }

    // Prevent self-deletion via admin route
    if (user.id === req.user!.id) {
      throw new AppError(ErrorCodes.CONFLICT.statusCode, ErrorCodes.CONFLICT.code, 'Cannot delete your own account via this endpoint');
    }

    await User.update(
      { status: 'deleted', deleted_at: new Date() },
      { where: { id: req.params.id } }
    );

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
