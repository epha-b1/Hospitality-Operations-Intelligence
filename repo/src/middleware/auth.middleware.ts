import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model';
import { authConfig } from '../config/auth';
import { JwtPayload, UserRole } from '../types/auth.types';
import { AppError, ErrorCodes } from '../utils/errors';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: UserRole;
    propertyId?: string;
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(
        ErrorCodes.UNAUTHORIZED.statusCode,
        ErrorCodes.UNAUTHORIZED.code,
        'Authentication required'
      );
    }

    const token = authHeader.slice(7);
    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, authConfig.secret, {
        algorithms: [authConfig.algorithm],
      }) as JwtPayload;
    } catch {
      throw new AppError(
        ErrorCodes.UNAUTHORIZED.statusCode,
        ErrorCodes.UNAUTHORIZED.code,
        'Invalid or expired token'
      );
    }

    const user = await User.findByPk(payload.userId);
    if (!user) {
      throw new AppError(
        ErrorCodes.UNAUTHORIZED.statusCode,
        ErrorCodes.UNAUTHORIZED.code,
        'User not found'
      );
    }

    if (user.status !== 'active' || user.deleted_at !== null) {
      throw new AppError(
        ErrorCodes.FORBIDDEN.statusCode,
        ErrorCodes.FORBIDDEN.code,
        'Account is not active'
      );
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role as UserRole,
      propertyId: user.property_id || undefined,
    };

    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(
        ErrorCodes.UNAUTHORIZED.statusCode,
        ErrorCodes.UNAUTHORIZED.code,
        'Authentication required'
      ));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new AppError(
        ErrorCodes.FORBIDDEN.statusCode,
        ErrorCodes.FORBIDDEN.code,
        `Access denied. Required role: ${roles.join(' or ')}`
      ));
      return;
    }

    next();
  };
}

export function requirePropertyScope(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    next(new AppError(
      ErrorCodes.UNAUTHORIZED.statusCode,
      ErrorCodes.UNAUTHORIZED.code,
      'Authentication required'
    ));
    return;
  }

  // hotel_admin has no property scope restriction
  if (req.user.role === 'hotel_admin') {
    next();
    return;
  }

  // manager must have a propertyId assigned
  if (req.user.role === 'manager' && !req.user.propertyId) {
    next(new AppError(
      ErrorCodes.FORBIDDEN.statusCode,
      ErrorCodes.FORBIDDEN.code,
      'Manager must be assigned to a property'
    ));
    return;
  }

  next();
}
