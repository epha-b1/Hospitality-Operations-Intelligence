import { Router } from 'express';
import * as accountsController from '../controllers/accounts.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/me', authMiddleware, accountsController.getProfile);
router.patch('/me', authMiddleware, accountsController.updateProfile);
router.post('/me/delete', authMiddleware, accountsController.deleteAccount);
router.post('/me/export', authMiddleware, accountsController.exportData);

export default router;
