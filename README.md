# evkom.dev

Retro 2000s-style personal portfolio for Egor Komarov.

## Features

### Hand-Crafted SSG

No webpack. No Vite. Just vibes. Custom Node.js engine renders pages like it's 1999.

- **Unified Pipeline**: One renderer rules them all—dev and prod
- **Recursive Includes**: `<x-include>` nests partials like Russian dolls
- **Hybrid Rendering**: Static by default, `<x-dynamic>` when you need it live

### Web 1.0 Aesthetic

Built different. Built better. Built without npm installing half the internet.

- **Zero Frameworks**: Pure HTML, CSS, JS. The holy trinity
- **Pixel Perfect**: 88x31 buttons, dithered GIFs, `Space Mono` everywhere
- **CSS Variables**: No magic numbers—everything lives in `variables.css`

### Security

Multi-layered protection for the guestbook:

- **Captcha**: Cloudflare Turnstile gate before form access
- **Session Tokens**: HMAC-signed, salted, 10min TTL with constant-time verification
- **Rate Limiting**: 50 requests per 15 minutes on `/api`
- **Input Validation**: Zod schemas strip unknown keys (anti-prototype pollution)
- **Size Limits**: Name ≤30 chars, message ≤2000 chars
- **XSS Prevention**: Auto-escaping via `validator.escape()` on storage and render

## Approach

### Philosophy

This project avoids modern bundlers and frameworks to maintain control and simplicity.

- **Performance**: Fast load times.
- **Transparency**: No hidden dependencies.
- **Longevity**: Uses standard web technologies (ESM, CSS3).

### Architecture

- **`backend/`**: Renderer, registries, and security logic.
- **`pages/`**: Templates (`.html`) and logic (`.server.js`).
- **`public/`**: Static assets.

## Setup

### Prerequisites

- Node.js v20+

### Configuration

Create a `.env` file in the root directory:

```bash
TURNSTILE_SITE_KEY=your_site_key
TURNSTILE_SECRET_KEY=your_secret_key
SESSION_SECRET_KEY=random_string_for_signing
GOOGLE_SERVICE_ACCOUNT='{"type": "service_account", ...}'
GOOGLE_SHEET_ID=your_sheet_id
GOOGLE_SHEET_NAME=Sheet1
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

Output generated in `dist/`.
