import { Router } from 'express';
import multer from 'multer';
import * as ctrl from '../controllers/files.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { userLimiter } from '../middleware/rate-limit.middleware';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router({ mergeParams: true });
router.use(authMiddleware);
router.use(userLimiter);

router.get('/', ctrl.listFiles);
router.post('/', upload.single('file'), ctrl.uploadFile);
router.get('/:fileId', ctrl.downloadFile);
router.delete('/:fileId', ctrl.deleteFile);

export default router;
