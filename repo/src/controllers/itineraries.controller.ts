import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as itineraryService from '../services/itinerary.service';

export async function createItem(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(await itineraryService.createItem(req.params.groupId, req.user!.id, req.body)); } catch (e) { next(e); }
}
export async function listItems(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json(await itineraryService.listItems(req.params.groupId, req.user!.id)); } catch (e) { next(e); }
}
export async function getItem(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json(await itineraryService.getItem(req.params.groupId, req.params.itemId, req.user!.id)); } catch (e) { next(e); }
}
export async function updateItem(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json(await itineraryService.updateItem(req.params.groupId, req.params.itemId, req.user!.id, req.body)); } catch (e) { next(e); }
}
export async function deleteItem(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { await itineraryService.deleteItem(req.params.groupId, req.params.itemId, req.user!.id); res.status(204).send(); } catch (e) { next(e); }
}
export async function addCheckpoint(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(await itineraryService.addCheckpoint(req.params.groupId, req.params.itemId, req.user!.id, req.body)); } catch (e) { next(e); }
}
export async function listCheckpoints(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json(await itineraryService.listCheckpoints(req.params.groupId, req.params.itemId, req.user!.id)); } catch (e) { next(e); }
}
export async function updateCheckpoint(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json(await itineraryService.updateCheckpoint(req.params.groupId, req.params.itemId, req.params.checkpointId, req.user!.id, req.body)); } catch (e) { next(e); }
}
export async function deleteCheckpoint(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { await itineraryService.deleteCheckpoint(req.params.groupId, req.params.itemId, req.params.checkpointId, req.user!.id); res.status(204).send(); } catch (e) { next(e); }
}
export async function checkin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json(await itineraryService.checkin(req.params.groupId, req.params.itemId, req.user!.id)); } catch (e) { next(e); }
}
