import { Router } from 'express';
import * as ctrl from '../controllers/audit.controller';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { userLimiter } from '../middleware/rate-limit.middleware';

const router = Router();
router.use(authMiddleware);
router.use(userLimiter);
router.use(requireRole('hotel_admin'));

router.get('/', ctrl.queryLogs);
router.get('/export', ctrl.exportLogs);

export default router;
