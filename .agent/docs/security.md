# Security

The only feature that writes data is the guestbook. Everything here protects that flow, plus the general hygiene of the server. Each section says what the code does and where it stops.

## Guestbook flow

1. The guestbook page shows a Cloudflare Turnstile widget. The browser sends the widget token as a POST to `/guestbook.html` ([`scripts/gate.js`](../../scripts/gate.js)).
2. The server checks it with Cloudflare `siteverify`, the server-side check of a Turnstile token ([`backend/captcha.js`](../../backend/captcha.js)). On success it renders the form with a session token in a hidden field.
3. The form posts `name`, `message` and the token to `POST /api/guestbook` ([`server.js`](../../server.js)). The server validates the body, verifies the token and appends a row to the Google Sheet.
4. Two things renew the token. After each successful post, the client sends a renewal POST of the token to the page path ([`scripts/guestbook.js`](../../scripts/guestbook.js)). A reload sends the token from the page URL as `?sessionToken=` in a GET. Both reach `renewSessionToken` ([`backend/captcha.js`](../../backend/captcha.js)), which returns a new token if the old one is still valid, and the page then shows the form again.

## Captcha gate

- The check fails closed. If `TURNSTILE_SECRET_KEY` is missing, or Cloudflare cannot be reached, the result is invalid and the error page shows. Only `--dev` skips the check when the secret is missing.
- Tests use Cloudflare's published dummy keys from `.env.test`. The dummy secret still calls `siteverify`, so those tests need network.

## Session token

- It is a JWT signed with HS256 ([jose](https://github.com/panva/jose)) and `SESSION_SECRET_KEY`. Verification accepts only HS256, the audience `guestbook`, and tokens that carry `exp`, `iat` and `sst`.
- Each token is valid 10 minutes. The `sst` claim holds the start of the session, which is the captcha solve. A session ends 30 minutes after `sst`.
- A renewal issues a new token with the same `sst`, so renewing cannot extend a session beyond 30 minutes. Example: a token issued at minute 0 expires at minute 10. Renewed at minute 9, the new token is valid until minute 19, but never past minute 30 after the captcha solve.
- If `SESSION_SECRET_KEY` is missing, no token is issued and every token fails verification.

**Limit: there is no replay protection.**

- The token is stateless and the server does not remember used tokens. While it is valid, one token can post many messages.
- The rate limits below bound the damage.
- The token sits in the page URL, so it is stored in browser history and can be copied with the link. The site accepts this trade-off. It sets `Referrer-Policy: no-referrer` so the browser does not send the URL to other sites.

## Input validation

[`backend/schemas.js`](../../backend/schemas.js) holds the schemas (zod).

- Page routes: the query and body of a page pass through the schema of that page. Unknown keys are dropped. Only the guestbook page accepts input (`cf-turnstile-response`, `sessionToken`, both strings). The captcha token `cf-turnstile-response` is read only from the body of a POST, so a GET can never start a Cloudflare check; `sessionToken` may also come from the query (a reload). Every other page gets no input. Input that fails the schema, such as a repeated query parameter, is treated as empty.
- `POST /api/guestbook`: `name` is a string of 1 to 30 characters and `message` of 1 to 2000, both after trimming and counted in UTF-16 units as zod counts them, and `sessionToken` is a string. A failure answers 400 with a JSON `error`. A bad or expired token answers 403.
- The JSON body limit is 10 kb. A larger body answers 413 and a malformed one 400, both as JSON on `/api`.

Validation checks shape and length. It does not restrict which characters a name or message may contain. Safety of the content comes from escaping.

## Escaping and storage

- On render, every `{{var}}` is HTML-escaped with `validator.escape`.
- On write ([`backend/google-sheets.js`](../../backend/google-sheets.js)), name and message are escaped, trimmed and wrapped in double quotes. The values are sent with `valueInputOption: 'RAW'`, so Sheets stores them as given and does not parse them. On read, the quotes are removed and the text is unescaped, and the renderer escapes it again.
- If `GOOGLE_SERVICE_ACCOUNT` is not set, reading returns an empty list and writing fails with 500.

## Rate limits

[`backend/rate-limit.js`](../../backend/rate-limit.js) creates the limiters, and [`server.js`](../../server.js) mounts them before the body parser, so oversized and malformed bodies count too.

| Scope                             | Limit                 |
| --------------------------------- | --------------------- |
| `/api`                            | 50 requests per 15 min |
| Any POST outside `/api` and `/api/...`, including POSTs to unknown paths and to paths such as `/apiary` | 30 requests per 15 min |

Each scope has its own store. A bucket is the counter that one client key has in a store, and a window is the 15-minute period it counts in. Over the limit the answer is JSON `429`. The stores are in memory, so counts reset when the process restarts and are not shared between instances.

The client key is the first value of the `do-connecting-ip` header if it is a valid IP, otherwise the socket IP. IPv6 addresses are grouped by network. A header value that is not an IP is ignored, so it cannot create its own bucket. `trust proxy` stays off, so `req.ip` is the proxy for everyone.

**Limit: the header is trustworthy only when the app is reached through the DigitalOcean ingress** (DigitalOcean's front proxy), which sets it. If a client can reach the app directly, it can send any value and pick its own bucket.

The first rejected request of a key in a window logs a `Rate limit: key=... do-connecting-ip=... x-forwarded-for=... cf-connecting-ip=... req.ip=...` line with `console.warn`.

## Headers

[`server.js`](../../server.js) configures helmet narrowly: `X-Content-Type-Options: nosniff`, framing denied (`X-Frame-Options: DENY` and a CSP that contains only `frame-ancestors 'none'`), `Referrer-Policy: no-referrer`, and no `X-Powered-By`. There is no full CSP, because pages use inline scripts and styles. There is no HSTS, and the cross-origin headers are off. Helmet defaults that the config does not disable stay on.

## Files

Page and partial files (page fragments such as the header) are loaded only through registry keys (the names in `PAGE_REGISTRY`), never through a path from the request. The `src` of `<x-inline-css>` and `<x-inline-js>` comes from the templates, which are trusted source. Static files are served from `dist/` or `public/` only, and `.html` files are never served as static files. See [architecture](architecture.md).
