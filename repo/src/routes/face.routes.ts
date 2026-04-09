import { Router } from 'express';
import multer from 'multer';
import * as ctrl from '../controllers/face.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { userLimiter } from '../middleware/rate-limit.middleware';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();
router.use(authMiddleware);
router.use(userLimiter);

router.post('/enroll/start', ctrl.startEnrollment);
router.post('/enroll/:sessionId/capture', upload.single('image'), ctrl.capture);
router.post('/enroll/:sessionId/complete', ctrl.complete);
router.get('/enrollments', ctrl.listEnrollments);
router.patch('/enrollments/:id', ctrl.deactivate);

export default router;
