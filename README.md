# evkom.dev

Retro 2000s-style personal portfolio for Egor Komarov. Built with a custom Node.js SSG and zero frameworks.

## Features

### Hand-Crafted SSG

- **Unified Pipeline**: One renderer handles both JIT development and static production builds.
- **Recursive Includes**: `<x-include>` allows nesting partials like Russian dolls.
- **Hybrid Rendering**: Static by default, using `<x-dynamic>` for live server-side components.
- **Zero Render-Blocking**: Essential CSS and JS are automatically inlined and minified.

### Web 1.0 Aesthetic

- **Pure Trinity**: Zero modern frameworks—just standard HTML, CSS, and Vanilla JS.
- **Dithered & Pixelated**: 88x31 buttons, dithered GIFs, and `Space Mono` typography.
- **Unified Design**: No magic numbers; all styles derived from `variables.css`.

### Multi-Layer Security

- **Captcha**: Cloudflare Turnstile protection for guestbook entries.
- **Session Tokens**: Stateless HMAC-signed tokens (10min TTL) with constant-time verification.
- **Rate Limiting**: Protected `/api` endpoints (50 requests per 15 mins).
- **Validation**: Zod schemas for strict input sanitization and anti-prototype pollution.
- **XSS Prevention**: Automatic escaping via `validator.escape()` in both renderer and storage.

## Setup

### Prerequisites

- Node.js v20+

### Configuration

Create a `.env` file in the root:

```bash
TURNSTILE_SITE_KEY=your_site_key
TURNSTILE_SECRET_KEY=your_secret_key
SESSION_SECRET_KEY=random_string_for_signing
GOOGLE_SERVICE_ACCOUNT='{"type": "service_account", ...}'
GOOGLE_SHEET_ID=your_sheet_id
GOOGLE_SHEET_NAME=Sheet1
```

### Commands

- `npm run dev`: Start dev server with JIT rendering and hot reload (localhost:8000).
- `npm run build`: Generate static production site in `dist/`.
- `npm start`: Run production server (serves from `dist/`).
