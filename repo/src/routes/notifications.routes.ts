import { Router } from 'express';
import * as ctrl from '../controllers/notifications.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { userLimiter } from '../middleware/rate-limit.middleware';

const router = Router();
router.use(authMiddleware);
router.use(userLimiter);

router.get('/', ctrl.queryNotifications);
router.patch('/:id/read', ctrl.markRead);

export default router;
