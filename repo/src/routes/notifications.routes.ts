import { Router } from 'express';
import * as ctrl from '../controllers/notifications.controller';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { userLimiter } from '../middleware/rate-limit.middleware';

const router = Router();
router.use(authMiddleware);
router.use(userLimiter);

// Notifications are an operational surface for hotel staff. The
// `member` user role is itinerary-only per the spec — members do not
// receive or query group activity notifications. Mounting the role
// gate here blocks every notification endpoint for member users while
// keeping admin/manager/analyst access intact.
router.use(requireRole('hotel_admin', 'manager', 'analyst'));

router.get('/', ctrl.queryNotifications);
router.patch('/:id/read', ctrl.markRead);

export default router;
