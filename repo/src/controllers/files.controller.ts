import { Response, NextFunction } from 'express';
import path from 'path';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as fileService from '../services/file.service';

export async function uploadFile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) { res.status(400).json({ code: 'VALIDATION_ERROR', message: 'No file provided' }); return; }
    const record = await fileService.uploadFile(req.params.groupId, req.user!.id, req.file);
    res.status(201).json(record);
  } catch (e) { next(e); }
}

export async function listFiles(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json(await fileService.listFiles(req.params.groupId, req.user!.id)); } catch (e) { next(e); }
}

export async function downloadFile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = await fileService.downloadFile(req.params.groupId, req.params.fileId, req.user!.id);
    res.download(path.resolve(file.storage_path), file.original_name);
  } catch (e) { next(e); }
}

export async function deleteFile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { await fileService.deleteFile(req.params.groupId, req.params.fileId, req.user!.id); res.status(204).send(); } catch (e) { next(e); }
}
