import { z } from 'zod';

/**
 * Schemas for validating user input (req.query, req.body) passed to pages.
 * By default, we strip unknown keys to prevent Prototype Pollution and unexpected behavior.
 */

const baseSchema = z.object({});

const guestbookSchema = baseSchema.extend({
  'cf-turnstile-response': z.string().optional(),
  sessionToken: z.string().optional(),
});

export const PAGE_SCHEMAS = {
  'page/guestbook': guestbookSchema,

  // Default schema for all other pages (strips all user input)
  default: baseSchema,
};
