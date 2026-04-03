import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as importService from '../services/import.service';

export async function downloadTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { datasetType } = req.params;
    if (!['staffing', 'evaluation'].includes(datasetType))
      return next({ statusCode: 400, code: 'VALIDATION_ERROR', message: 'Invalid dataset type' });
    const wb = await importService.getTemplate(datasetType);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${datasetType}-template.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { next(e); }
}

export async function upload(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) { res.status(400).json({ code: 'VALIDATION_ERROR', message: 'No file provided' }); return; }
    const datasetType = req.body.datasetType;
    if (!['staffing', 'evaluation'].includes(datasetType)) { res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid datasetType' }); return; }
    const result = await importService.uploadAndValidate(req.user!.id, datasetType, req.file.buffer);
    res.json(result);
  } catch (e) { next(e); }
}

export async function commit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json(await importService.commitBatch(req.params.batchId, req.user!.id)); } catch (e) { next(e); }
}

export async function getBatch(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json(await importService.getBatch(req.params.batchId, req.user!.id)); } catch (e) { next(e); }
}

function enforceManagerScope(req: AuthenticatedRequest): string | undefined {
  if (req.user!.role === 'manager') {
    if (!req.user!.propertyId) throw new (require('../utils/errors').AppError)(403, 'FORBIDDEN', 'Manager must be assigned to a property');
    if (req.query.propertyId && req.query.propertyId !== req.user!.propertyId)
      throw new (require('../utils/errors').AppError)(403, 'FORBIDDEN', 'Access denied to this property');
    return req.user!.propertyId;
  }
  return req.query.propertyId as string | undefined;
}

export async function staffingReport(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const scopedPropertyId = enforceManagerScope(req);
    res.json(await importService.staffingReport({ ...req.query as any, propertyId: scopedPropertyId }));
  } catch (e) { next(e); }
}

export async function evaluationReport(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const scopedPropertyId = enforceManagerScope(req);
    res.json(await importService.evaluationReport({ ...req.query as any, propertyId: scopedPropertyId }));
  } catch (e) { next(e); }
}
