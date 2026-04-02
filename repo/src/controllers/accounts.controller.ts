import { Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export async function getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await authService.getProfile(req.user!.id);
    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const allowedFields: Record<string, string> = {
      legalName: 'legal_name',
      addressLine1: 'address_line1',
      addressLine2: 'address_line2',
      city: 'city',
      state: 'state',
      zip: 'zip',
      taxInvoiceTitle: 'tax_invoice_title',
      preferredCurrency: 'preferred_currency',
    };

    const data: Record<string, string> = {};
    for (const [camel, snake] of Object.entries(allowedFields)) {
      if (req.body[camel] !== undefined) {
        data[snake] = req.body[camel];
      }
    }

    const profile = await authService.updateProfile(req.user!.id, data);
    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
}

export async function deleteAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { password } = req.body;
    await authService.deleteAccount(req.user!.id, password);
    res.status(200).json({ message: 'Account deleted' });
  } catch (err) {
    next(err);
  }
}

export async function exportData(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.exportData(req.user!.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
