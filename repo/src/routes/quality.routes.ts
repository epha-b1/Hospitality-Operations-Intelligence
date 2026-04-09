import { Router } from 'express';
import * as ctrl from '../controllers/quality.controller';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { userLimiter } from '../middleware/rate-limit.middleware';

const router = Router();
router.use(authMiddleware);
router.use(userLimiter);
router.use(requireRole('hotel_admin'));

router.get('/checks', ctrl.listChecks);
router.post('/checks', ctrl.createCheck);
router.post('/checks/:id/run', ctrl.runCheck);
router.get('/results', ctrl.getResults);

export default router;
