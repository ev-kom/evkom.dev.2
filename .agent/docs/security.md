# Security

## Input Validation

**File**: `backend/schemas.js`

- All inputs (`query`, `body`) are stripped by default.
- **Must** define a Zod schema for any page accepting input.
- **Format**: `PAGE_SCHEMAS['page/<url>'] = z.object(...)`

## Authentication

**File**: `backend/captcha.js`

- **Turnstile**: `verifyTurnstileToken(token)`
- **Session**: Stateless HMAC-SHA256 (`timestamp:salt:signature`).
  - TTL: 10 minutes.
  - Protection: Replay attacks & Timing attacks.

## Sanitization

- **XSS**: `{{var}}` interpolation auto-escapes using `validator.escape()`.
- **Assets**: `backend/renderer.js` strictly limits file access to specific directories.
