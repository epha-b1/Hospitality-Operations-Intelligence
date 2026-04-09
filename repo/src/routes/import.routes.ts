import { Router } from 'express';
import multer from 'multer';
import * as ctrl from '../controllers/import.controller';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { userLimiter } from '../middleware/rate-limit.middleware';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.get('/templates/:datasetType', ctrl.downloadTemplate);

router.use(authMiddleware);
router.use(userLimiter);
router.use(requireRole('hotel_admin', 'manager'));

router.post('/upload', upload.single('file'), ctrl.upload);
router.post('/:batchId/commit', ctrl.commit);
router.get('/:batchId', ctrl.getBatch);

export default router;
