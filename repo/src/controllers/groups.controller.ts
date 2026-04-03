import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as groupService from '../services/group.service';

export async function createGroup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const group = await groupService.createGroup(req.user!.id, req.body.name);
    res.status(201).json(group);
  } catch (err) { next(err); }
}

export async function listGroups(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const groups = await groupService.listGroups(req.user!.id);
    res.status(200).json(groups);
  } catch (err) { next(err); }
}

export async function getGroup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const group = await groupService.getGroup(req.params.id, req.user!.id);
    res.status(200).json(group);
  } catch (err) { next(err); }
}

export async function updateGroup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const group = await groupService.updateGroup(req.params.id, req.user!.id, req.body);
    res.status(200).json(group);
  } catch (err) { next(err); }
}

export async function joinGroup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const group = await groupService.joinGroup(req.user!.id, req.body.joinCode);
    res.status(200).json(group);
  } catch (err) { next(err); }
}

export async function listMembers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const members = await groupService.listMembers(req.params.id, req.user!.id);
    res.status(200).json(members);
  } catch (err) { next(err); }
}

export async function removeMember(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await groupService.removeMember(req.params.id, req.user!.id, req.params.userId);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function listRequiredFields(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const fields = await groupService.listRequiredFields(req.params.id, req.user!.id);
    res.status(200).json(fields);
  } catch (err) { next(err); }
}

export async function addRequiredField(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const field = await groupService.addRequiredField(req.params.id, req.user!.id, req.body);
    res.status(201).json(field);
  } catch (err) { next(err); }
}

export async function updateRequiredField(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const field = await groupService.updateRequiredField(req.params.id, req.user!.id, req.params.fieldId, req.body);
    res.status(200).json(field);
  } catch (err) { next(err); }
}

export async function deleteRequiredField(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await groupService.deleteRequiredField(req.params.id, req.user!.id, req.params.fieldId);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function getMyFields(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const fields = await groupService.getMyFields(req.params.id, req.user!.id);
    res.status(200).json(fields);
  } catch (err) { next(err); }
}

export async function submitMyFields(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await groupService.submitMyFields(req.params.id, req.user!.id, req.body);
    res.status(200).json(result);
  } catch (err) { next(err); }
}
