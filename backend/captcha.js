import { jwtVerify, SignJWT } from 'jose';

import { IS_DEV } from './mode.js';

const SESSION_SECRET = process.env.SESSION_SECRET_KEY;
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

/**
 * Enum for Captcha Verification States
 */
export const CaptchaState = {
  VALID: 'VALID',
  INVALID: 'INVALID',
  EMPTY: 'EMPTY',
};

/**
 * Verifies a Cloudflare Turnstile token.
 * @param {string} token - The token from `cf-turnstile-response`.
 * @returns {Promise<string>} One of CaptchaState values.
 */
export async function verifyTurnstileToken(token) {
  if (!token) {
    return CaptchaState.EMPTY;
  }

  if (!TURNSTILE_SECRET_KEY) {
    // Fail closed: a missing secret must never let everyone through. Dev mode may skip.
    if (IS_DEV) {
      console.warn(
        'TURNSTILE_SECRET_KEY is not defined. Skipping verification (dev mode).'
      );
      return CaptchaState.VALID;
    }
    console.error(
      'TURNSTILE_SECRET_KEY is not defined. Rejecting the captcha (fail closed).'
    );
    return CaptchaState.INVALID;
  }

  try {
    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: TURNSTILE_SECRET_KEY,
          response: token,
        }),
        signal: AbortSignal.timeout(5000),
      }
    );

    const data = await response.json();

    if (data.success) {
      return CaptchaState.VALID;
    } else {
      console.warn('Turnstile verification failed:', data['error-codes']);
      return CaptchaState.INVALID;
    }
  } catch (error) {
    console.error('Error verifying Turnstile token:', error);
    return CaptchaState.INVALID;
  }
}

const TOKEN_MAX_AGE_S = 10 * 60; // one token, since it was issued
const SESSION_MAX_AGE_MS = 30 * 60 * 1000; // whole session, since the captcha solve
const AUDIENCE = 'guestbook';
const KEY = SESSION_SECRET ? new TextEncoder().encode(SESSION_SECRET) : null;

/**
 * Verifies a session token (HS256 JWT). Never throws.
 * jose checks signature, algorithm whitelist, `exp` (10 min) and audience;
 * the custom `sst` claim (session start, ms) caps the whole session at 30 min.
 * @returns {Promise<{sessionStart: number}|null>} The session start when valid, else null.
 */
async function parseSessionToken(token) {
  if (typeof token !== 'string' || !KEY) return null;
  try {
    const { payload } = await jwtVerify(token, KEY, {
      algorithms: ['HS256'],
      audience: AUDIENCE,
      requiredClaims: ['exp', 'iat', 'sst'],
    });
    const sessionStart = payload.sst;
    const now = Date.now();
    if (
      typeof sessionStart !== 'number' ||
      !(now - sessionStart < SESSION_MAX_AGE_MS)
    )
      return null;
    return { sessionStart };
  } catch {
    return null;
  }
}

/**
 * Generates a signed session token (HS256 JWT with a custom `sst` session-start claim).
 * Without an argument it starts a new session (after a captcha solve).
 * @param {number} [sessionStart] - Start of an existing session (renewals).
 * @returns {Promise<string|null>} The token, or null when SESSION_SECRET_KEY is missing.
 */
export async function generateSessionToken(sessionStart = Date.now()) {
  if (!KEY) {
    console.error(
      'SESSION_SECRET_KEY is not defined. Cannot generate session token.'
    );
    return null;
  }
  const iat = Math.floor(Date.now() / 1000);
  return new SignJWT({ sst: sessionStart })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(AUDIENCE)
    .setIssuedAt(iat)
    .setExpirationTime(iat + TOKEN_MAX_AGE_S)
    .sign(KEY);
}

/**
 * Verifies the session token: signature, token age (10 min) and session age (30 min).
 * @returns {Promise<boolean>} Never throws; any malformed value is false.
 */
export async function verifySessionToken(token) {
  return (await parseSessionToken(token)) !== null;
}

/**
 * Issues a fresh token for a still-valid one, keeping the original session start,
 * so renewals cannot extend a session past 30 minutes from the captcha solve.
 * @returns {Promise<string|null>} The new token, or null when the old one is invalid.
 */
export async function renewSessionToken(oldToken) {
  const parsed = await parseSessionToken(oldToken);
  return parsed ? generateSessionToken(parsed.sessionStart) : null;
}
