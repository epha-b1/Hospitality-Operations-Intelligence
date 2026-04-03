import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as qualityService from '../services/quality.service';

export async function createCheck(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(await qualityService.createCheck(req.body)); } catch (e) { next(e); }
}
export async function listChecks(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json(await qualityService.listChecks()); } catch (e) { next(e); }
}
export async function runCheck(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json(await qualityService.runCheck(req.params.id)); } catch (e) { next(e); }
}
export async function getResults(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json(await qualityService.getResults()); } catch (e) { next(e); }
}
