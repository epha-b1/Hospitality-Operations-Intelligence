import { Router } from 'express';
import * as ctrl from '../controllers/itineraries.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });
router.use(authMiddleware);

router.get('/', ctrl.listItems);
router.post('/', ctrl.createItem);
router.get('/:itemId', ctrl.getItem);
router.patch('/:itemId', ctrl.updateItem);
router.delete('/:itemId', ctrl.deleteItem);

router.get('/:itemId/checkpoints', ctrl.listCheckpoints);
router.post('/:itemId/checkpoints', ctrl.addCheckpoint);
router.patch('/:itemId/checkpoints/:checkpointId', ctrl.updateCheckpoint);
router.delete('/:itemId/checkpoints/:checkpointId', ctrl.deleteCheckpoint);

router.post('/:itemId/checkin', ctrl.checkin);

export default router;
