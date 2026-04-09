import { Router } from 'express';
import * as accountsController from '../controllers/accounts.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { userLimiter } from '../middleware/rate-limit.middleware';
import { validate } from '../middleware/validation.middleware';
import { updateProfileSchema } from '../utils/validation';

const router = Router();

// Apply auth + per-user rate limit to every /accounts/me route. userLimiter
// runs AFTER authMiddleware so req.user is populated and the per-user key
// is used instead of the coarser IP fallback.
router.use(authMiddleware);
router.use(userLimiter);

router.get('/me', accountsController.getProfile);
router.patch('/me', validate(updateProfileSchema), accountsController.updateProfile);
router.post('/me/delete', accountsController.deleteAccount);
router.post('/me/export', accountsController.exportData);

export default router;
