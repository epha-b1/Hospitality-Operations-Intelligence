import { Router } from 'express';
import multer from 'multer';
import * as ctrl from '../controllers/files.controller';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { userLimiter } from '../middleware/rate-limit.middleware';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router({ mergeParams: true });
router.use(authMiddleware);
router.use(userLimiter);

// Group-file collaboration is NOT in scope for the `member` user role.
// The product spec frames members as itinerary-only participants — they
// can join groups, view trip itineraries, and check in, but they do not
// upload, download, or manage shared files. Files belong to the
// hotel_admin / manager / analyst content path. The role gate enforces
// this at the route layer (defense in depth alongside the per-group
// `assertGroupOwnerOrAdmin` checks for delete in the service layer).
router.use(requireRole('hotel_admin', 'manager', 'analyst'));

router.get('/', ctrl.listFiles);
router.post('/', upload.single('file'), ctrl.uploadFile);
router.get('/:fileId', ctrl.downloadFile);
router.delete('/:fileId', ctrl.deleteFile);

export default router;
