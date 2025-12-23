import crypto, { createHmac, randomBytes } from 'node:crypto';

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
    console.info(
      'TURNSTILE_SECRET_KEY is not defined in environment variables. Skipping verification.'
    );
    return CaptchaState.VALID;
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

/**
 * Generates a signed session token.
 * Token format: timestamp:salt:hmac
 */
export function generateSessionToken() {
  if (!SESSION_SECRET) {
    console.warn(
      'SESSION_SECRET_KEY is not defined. Cannot generate session token.'
    );
    return null;
  }
  const timestamp = Date.now().toString();
  const salt = randomBytes(16).toString('hex');
  const data = `${timestamp}:${salt}:guestbook`;
  const signature = createHmac('sha256', SESSION_SECRET)
    .update(data)
    .digest('hex');
  return `${timestamp}:${salt}:${signature}`;
}

/**
 * Verifies the session token.
 * Checks signature and expiration (e.g. 1 hour).
 */
export function verifySessionToken(token) {
  if (!token || !SESSION_SECRET) return false;

  const [timestamp, salt, signature] = token.split(':');
  if (!timestamp || !salt || !signature) return false;

  // Check expiration (10 minutes)
  const now = Date.now();
  if (now - parseInt(timestamp, 10) > 10 * 60 * 1000) {
    return false;
  }

  const data = `${timestamp}:${salt}:guestbook`;
  const expectedSignature = createHmac('sha256', SESSION_SECRET)
    .update(data)
    .digest('hex');

  const signatureBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  // Constant-time comparison to prevent timing attacks
  return (
    signatureBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  );
}
