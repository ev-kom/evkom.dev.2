# evkom.dev

Retro 2000s SSG. No frameworks.

## Commands

- `npm run dev` -- Dev server (localhost:8000)
- `npm run build` -- Generate static `dist/`
- `npm start` -- Prod server (localhost:3000)

## Critical Architecture

- **Renderer** (`backend/renderer.js`): Unified engine for dev (JIT) and prod (hydration).
- **Registries** (`backend/registries.js`):
  - `PAGE_REGISTRY`: URL path -> HTML file.
  - `DYNAMIC_REGISTRY`: Tag key -> Server handler.
- **Custom Tags**:
  - `<x-include src="...">` -- Statics.
  - `<x-dynamic src="...">` -- Dynamic components.
  - `<x-inline-css src="...">` / `<x-inline-js src="...">` -- Required. Assets must be inlined.
  - `{{varName}}` -- Inline variable injection for string nodes.

## Essential Conventions

- **Clean Structure**: HTML for structure, CSS for presentation, JS for behavior. No inline styles or `<script>` in `<body>`.
- **Performance**: LCP images must use `fetchpriority="high"` and `loading="eager"`.
- **Accessibility**: Strict heading hierarchy (`h1` -> `h2` -> `h3`) and `<main>` landmark are mandatory.
- **Design**: Use semantic tokens from `variables.css`. No hardcoded colors.
- **CSS Reuse**: Check `styles/base.css` and existing patterns in `styles/` before adding new ones.

## Security

- **Auth**: Cloudflare Turnstile + stateless HMAC-signed tokens (10min TTL). See `backend/captcha.js`
- **Validation**: Zod schemas strip unknown keys (`backend/schemas.js`), rate-limiting on `/api` (`server.js`).
- **Sanitization**: `validator.escape()` for XSS, safe `decodeURIComponent` for paths.
- **Constraints**: Payload size limits enforced in `server.js` handlers.

## Post-Implementation Checklist

1. Update `pages/manifest/manifest.html` if pages change.
2. Update `README.md` and `GEMINI.md` if architecture or patterns change.
3. Verify Lighthouse status: Performance, Accessibility, Best Practices, SEO.
