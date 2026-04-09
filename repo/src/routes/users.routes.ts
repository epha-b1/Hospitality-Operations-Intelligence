import { Router } from 'express';
import * as usersController from '../controllers/users.controller';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { userLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

router.use(authMiddleware);
router.use(userLimiter);
router.use(requireRole('hotel_admin'));

router.get('/', usersController.listUsers);
router.get('/:id', usersController.getUser);
router.patch('/:id', usersController.updateUser);
router.delete('/:id', usersController.deleteUser);

export default router;
