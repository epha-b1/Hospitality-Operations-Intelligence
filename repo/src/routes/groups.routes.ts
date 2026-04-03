import { Router } from 'express';
import * as groupsController from '../controllers/groups.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createGroupSchema, joinGroupSchema } from '../utils/validation';

const router = Router();

router.use(authMiddleware);

router.post('/', validate(createGroupSchema), groupsController.createGroup);
router.get('/', groupsController.listGroups);
router.post('/join', validate(joinGroupSchema), groupsController.joinGroup);

router.get('/:id', groupsController.getGroup);
router.patch('/:id', groupsController.updateGroup);

router.get('/:id/members', groupsController.listMembers);
router.delete('/:id/members/:userId', groupsController.removeMember);

router.get('/:id/required-fields', groupsController.listRequiredFields);
router.post('/:id/required-fields', groupsController.addRequiredField);
router.patch('/:id/required-fields/:fieldId', groupsController.updateRequiredField);
router.delete('/:id/required-fields/:fieldId', groupsController.deleteRequiredField);

router.get('/:id/my-fields', groupsController.getMyFields);
router.put('/:id/my-fields', groupsController.submitMyFields);

export default router;
