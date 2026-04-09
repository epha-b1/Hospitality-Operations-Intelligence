import { Router } from 'express';
import * as ctrl from '../controllers/reports.controller';
import * as importCtrl from '../controllers/import.controller';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { userLimiter } from '../middleware/rate-limit.middleware';

const router = Router();
router.use(authMiddleware);
router.use(userLimiter);
router.use(requireRole('hotel_admin', 'manager', 'analyst'));

router.get('/occupancy', ctrl.occupancy);
router.get('/adr', ctrl.adr);
router.get('/revpar', ctrl.revpar);
router.get('/revenue-mix', ctrl.revenueMix);
router.post('/export', ctrl.exportReport);
router.get('/staffing', importCtrl.staffingReport);
router.get('/evaluations', importCtrl.evaluationReport);

export default router;
