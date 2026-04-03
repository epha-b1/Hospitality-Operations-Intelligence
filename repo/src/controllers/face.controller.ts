import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as faceService from '../services/face.service';

export async function startEnrollment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(await faceService.startSession(req.user!.id)); } catch (e) { next(e); }
}
export async function capture(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = { angle: req.body.angle, blinkTimingMs: Number(req.body.blinkTimingMs), motionScore: Number(req.body.motionScore), textureScore: Number(req.body.textureScore) };
    const imageBuffer = req.file?.buffer;
    res.json(await faceService.capture(req.params.sessionId, req.user!.id, data, imageBuffer));
  } catch (e) { next(e); }
}
export async function complete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(await faceService.completeSession(req.params.sessionId, req.user!.id)); } catch (e) { next(e); }
}
export async function listEnrollments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json(await faceService.listEnrollments(req.user!.id)); } catch (e) { next(e); }
}
export async function deactivate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json(await faceService.deactivateEnrollment(req.params.id, req.user!.id)); } catch (e) { next(e); }
}
