import { Router } from 'express';
import * as groupsController from '../controllers/groups.controller';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { userLimiter } from '../middleware/rate-limit.middleware';
import { validate } from '../middleware/validation.middleware';
import { createGroupSchema, joinGroupSchema } from '../utils/validation';

const router = Router();

router.use(authMiddleware);
router.use(userLimiter);

// ─── Member-permitted endpoints ─────────────────────────────────────
//
// The `member` user role is itinerary-only per the spec, but members
// still need a minimal slice of the group surface so they can REACH
// the itineraries they care about: they have to join a group, see the
// list of groups they belong to, view the group they joined, see who
// the other participants are, and submit their own required-field
// values for the check-in flow. These read/self-write endpoints are
// the only `/groups` paths that stay open to members.

router.post('/join', validate(joinGroupSchema), groupsController.joinGroup);
router.get('/', groupsController.listGroups);
router.get('/:id', groupsController.getGroup);
router.get('/:id/members', groupsController.listMembers);
router.get('/:id/required-fields', groupsController.listRequiredFields);
router.get('/:id/my-fields', groupsController.getMyFields);
router.put('/:id/my-fields', groupsController.submitMyFields);

// ─── Admin / manager / analyst-only endpoints ───────────────────────
//
// Group lifecycle (create, rename, archive), member management, and
// required-field configuration are administrative actions. The
// `requireAdminRoles` gate blocks `member` users from any of these
// surfaces. The downstream service layer still enforces "must be the
// group owner or admin" via `assertGroupOwnerOrAdmin` for the actions
// that mutate per-group state — this route gate is the outermost
// belt-and-braces check.
const requireAdminRoles = requireRole('hotel_admin', 'manager', 'analyst');

router.post('/', requireAdminRoles, validate(createGroupSchema), groupsController.createGroup);
router.patch('/:id', requireAdminRoles, groupsController.updateGroup);

router.delete('/:id/members/:userId', requireAdminRoles, groupsController.removeMember);

router.post('/:id/required-fields', requireAdminRoles, groupsController.addRequiredField);
router.patch('/:id/required-fields/:fieldId', requireAdminRoles, groupsController.updateRequiredField);
router.delete('/:id/required-fields/:fieldId', requireAdminRoles, groupsController.deleteRequiredField);

export default router;
