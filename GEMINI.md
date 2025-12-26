# evkom.dev

Retro 2000s portfolio. Custom Node.js SSG. No frameworks.

## Commands

- `npm run dev` -- Dev server with hot reload (localhost:8000)
- `npm run build` -- Generate static `dist/`
- `node --env-file=.env server.js --dev` -- Manual debug

## Architecture

**Renderer** (`backend/renderer.js`): Unified engine for dev (JIT) and prod (hydration).

**Registries** (`backend/registries.js`):

- `PAGE_REGISTRY`: URL path -> HTML file
- `DYNAMIC_REGISTRY`: Tag key -> Server handler

**Custom Tags**:

- `<x-include src="shared/header">` -- Static partial
- `<x-dynamic src="guestbook/content">` -- Dynamic component (server-rendered)
- `<x-var name="title">` -- Variable injection
- `{{varName}}` -- Inline variable (for attrs, scripts, non-traversable nodes)

## How To

**Add Page**: Register in `PAGE_REGISTRY`, create HTML in `pages/`.

**Add Dynamic Logic**: Register in `DYNAMIC_REGISTRY`, implement `*.server.js` handler, embed with `<x-dynamic>`.

## Conventions

- HTML for structure, CSS for presentation, JS for behavior
- No inline styles, no `<script>` in body
- **Retro CSS**:
  - Use `var(--pixel-grey-1)` from `variables.css`.
  - Use `border: 2px solid black`.
  - Font: `Space Mono`.
- **CSS Reuse**:
  - Check `public/css/base.css` first for utilities (e.g. `.flex-gap`, `.icon-xs`).
  - Search `public/css/*.css` for existing patterns before adding new ones.g new ones.
- Design patterns: see `public/css/`

## Env Variables

- `SESSION_SECRET_KEY` -- HMAC signing for session tokens (required)
- `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` -- Cloudflare captcha
- `GOOGLE_SERVICE_ACCOUNT` -- JSON credentials for Sheets API
- `GOOGLE_SHEET_ID` / `GOOGLE_SHEET_NAME` -- Guestbook storage
- `PORT` -- Server port (default: 8000 dev, 3000 prod)

## Security

- **Captcha**: Cloudflare Turnstile on guestbook gate
- **Session Token**: Stateless HMAC-signed (10min TTL). See `backend/captcha.js`
- **Rate Limiting**: express-rate-limit on `/api`. See `server.js`
- **Input Validation**: Zod schemas strip unknown keys (`backend/schemas.js`)
- **Size Limits**: See `server.js` `/api/guestbook` handler
- **XSS Prevention**: Auto-escape via `validator.escape()` in renderer and storage
- **URL Escaping**: Safe `decodeURIComponent` in `server.js` path sanitization

## Post-Implementation Checklist

After completing any plan, update:

1. `pages/manifest/manifest.html` -- Site map if pages added/removed
2. `GEMINI.md` -- Architecture/conventions if patterns changed
3. `README.md` -- User-facing docs if features changed
