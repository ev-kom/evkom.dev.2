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

/** Body of POST /api/guestbook. Whitespace is trimmed before the length checks. */
export const guestbookPostSchema = z.object({
  name: z
    .string('DATA CORRUPTION: INVALID NAME FIELD.')
    .trim()
    .min(1, 'DATA CORRUPTION: MISSING INPUT FIELDS.')
    .max(30, 'BUFFER OVERFLOW: NAME EXCEEDS 30 CHARACTERS.'),
  message: z
    .string('DATA CORRUPTION: INVALID MESSAGE FIELD.')
    .trim()
    .min(1, 'DATA CORRUPTION: MISSING INPUT FIELDS.')
    .max(2000, 'BUFFER OVERFLOW: MESSAGE EXCEEDS 2000 CHARACTERS.'),
  sessionToken: z.string('DATA CORRUPTION: INVALID SESSION TOKEN.'),
});
