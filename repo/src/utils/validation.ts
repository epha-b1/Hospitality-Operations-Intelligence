import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().min(1, 'username is required'),
  password: z.string().min(10, 'Password must be at least 10 characters'),
});

export const loginSchema = z.object({
  username: z.string().min(1, 'username is required'),
  password: z.string().min(1, 'password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10),
});

export const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required'),
});

export const joinGroupSchema = z.object({
  joinCode: z.string().min(1, 'Join code is required'),
});

export const createItinerarySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  meetupDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'meetupDate must be MM/DD/YYYY'),
  meetupTime: z.string().min(1, 'meetupTime is required'),
  meetupLocation: z.string().min(1, 'meetupLocation is required'),
  idempotencyKey: z.string().min(1, 'idempotencyKey is required'),
  notes: z.string().max(2000).optional(),
});

export const updateItinerarySchema = z.object({
  idempotencyKey: z.string().min(1, 'idempotencyKey is required'),
  title: z.string().optional(),
  meetupDate: z.string().optional(),
  meetupTime: z.string().optional(),
  meetupLocation: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export const importUploadSchema = z.object({
  datasetType: z.enum(['staffing', 'evaluation']),
});

export const reportExportSchema = z.object({
  reportType: z.enum(['occupancy', 'adr', 'revpar', 'revenue_mix']),
  from: z.string().min(1),
  to: z.string().min(1),
  format: z.enum(['csv', 'excel']),
  groupBy: z.string().optional(),
  propertyId: z.string().optional(),
  includePii: z.boolean().optional(),
});
