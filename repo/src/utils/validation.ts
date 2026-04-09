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

// --- Account profile (/accounts/me) ---------------------------------------
// The prompt frames users as US-based customers; we enforce:
//   * state   — 2-letter uppercase US state / territory code
//   * zip     — US ZIP (5 digits) or ZIP+4 (5-4)
//   * currency— ISO 4217 3-letter uppercase code
// Field length bounds mirror the DB column lengths in users model so rejecting
// at the edge prevents silent truncation later.

const US_STATE_CODES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
  // US territories and DC
  'DC','AS','GU','MP','PR','VI',
] as const;

const US_ZIP_REGEX = /^\d{5}(-\d{4})?$/;
const CURRENCY_REGEX = /^[A-Z]{3}$/;

export const updateProfileSchema = z
  .object({
    legalName: z.string().trim().min(1).max(255).optional(),
    addressLine1: z.string().trim().min(1).max(255).optional(),
    addressLine2: z.string().trim().max(255).optional(),
    city: z.string().trim().min(1).max(100).optional(),
    state: z
      .string()
      .trim()
      .length(2, 'state must be a 2-letter US state code')
      .regex(/^[A-Z]{2}$/, 'state must be uppercase 2-letter US state code')
      .refine((s) => (US_STATE_CODES as readonly string[]).includes(s), {
        message: 'state must be a valid US state/territory code',
      })
      .optional(),
    zip: z
      .string()
      .trim()
      .regex(US_ZIP_REGEX, 'zip must be a US ZIP (12345) or ZIP+4 (12345-6789)')
      .optional(),
    taxInvoiceTitle: z.string().trim().max(255).optional(),
    preferredCurrency: z
      .string()
      .trim()
      .regex(CURRENCY_REGEX, 'preferredCurrency must be a 3-letter ISO 4217 code (e.g. USD, EUR)')
      .optional(),
  })
  .strict();
