# evkom.dev

Retro 2000s-style personal portfolio for Egor Komarov.

## Features

### Custom SSG & Universal Rendering

The site runs on a custom Static Site Generator built in Node.js.

- **Unified Pipeline**: The core renderer (`backend/renderer.js`) powers both the live dev server and the production build.
- **Recursive Composition**: Supports nesting partials using `<x-include>` tags.
- **Hybrid Rendering**: Components render statically by default but can use `<x-dynamic>` for runtime updates.

### Retro UI

- **No Frameworks**: Pure HTML and CSS. No React, Vue, or Tailwind.
- **Systematic Styling**: Use `variables.css` for consistent styling (fonts, colors, borders) instead of hardcoded values.
- **Pixelated Assets**: Uses 88x31 buttons and dithering effects.

### Guestbook Security

A spam-resistant commenting system.

1.  **Gate**: Generates a Cloudflare Turnstile token on the client.
2.  **Session**: Server validates Turnstile and issues a signed Session Token.
3.  **Submission**: Message submission requires the encrypted session token.
4.  **Verification**: Uses constant-time signature verification to prevent timing attacks.

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
