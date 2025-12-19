## Project Overview

This project is a personal portfolio website for Egor Komarov, a software engineer. The website is designed with a retro 2000s aesthetic, reminiscent of early personal homepages. It features a 3-column layout with a central content area and sidebars. The technology stack consists of HTML, CSS, and a custom Node.js Static Site Generator (SSG).

The project structure is organized into `pages/` for content logic and templates, and `public/` for static assets.

The visual theme is inspired by early graphical user interfaces, using the font "Space Mono" for all text, along with blocky borders, and an adjusted color palette with lighter grays for the sidebars. The layout is implemented using CSS Grid.

## Project Philosophy

This project explicitly avoids modern frontend frameworks (React, Vue, etc.) to maintain a lightweight, fast, and "close to the metal" codebase. The goal is to write high-quality, maintainable, and modern "Vanilla JS" and CSS, proving that you can build complex, interactive experiences without heavy client-side bundles. Dependencies are strictly minimized and only used when they offer significant value, ensuring the site remains extremely lightweight.

Yes, we reinvented the wheel by writing a custom static site generator and server from scratch using Node.js, Express, and EJS. But sometimes, reinventing the wheel is the best way to understand how it rolls—and it's a lot more fun than configuring Webpack for the 500th time.

## Building and Running

This is a static website generated via Node.js.

### Prerequisites

- Node.js (v20+ recommended for native `.env` support)

### Configuration

The project uses environment variables for sensitive data. Create a `.env` file in the root directory (see `.env.example` for details):

- `TURNSTILE_SITE_KEY`: Cloudflare Turnstile Site Key.
- `TURNSTILE_SECRET_KEY`: Cloudflare Turnstile Secret Key.
- `GOOGLE_SERVICE_ACCOUNT`: Google Service Account JSON for Google Sheets API.
- `GOOGLE_SHEET_ID`: ID of the Google Sheet for guestbook data.
- `GOOGLE_SHEET_NAME`: Name of the sheet (tab) to use.

### Development

To run the development server (auto-assembles pages on request):

```bash
npm run dev
# or: node server.js --dev
```

Open `http://localhost:8000` in your browser.

### Production Build

To generate the static site for deployment:

```bash
npm run build
# or: node build.js
```

The output will be in the `dist/` directory.

## Development Conventions

- **Pages**: Located in `pages/[name]/`. Each page directory contains:
  - `[name].html`: The HTML template.
  - `[name].server.js`: Optional server-side logic (dynamic rendering).
- **Public Assets**: All static assets (CSS, JS, Images) are in `public/`.
- **Styling**: CSS is used for all styling.
- **Shared**: Shared HTML elements in `shared/`.
- **Configuration**:
  - `site.config.js`: **IMPORTANT**. Central configuration file at the project root. Defines pages, static directories, and global site data.
- **Data**: Global variables are in `site.config.js`. Guestbook data is stored in Google Sheets via `backend/google-sheets.js`.

## Architecture

The site uses an enhanced **two-phase rendering pipeline**:

1.  **Static Phase** (`backend/static-renderer.js`): Processes standard EJS templates (`<% %>`) during `npm run build`. This generates the static HTML files in `dist/`.
2.  **Dynamic Phase** (`backend/dynamic-renderer.js`): Re-processes the HTML at runtime (in Development) or on request (in Production) to inject session-specific content.
    - **Logic Loading**: Uses a manual `PAGE_HANDLERS` registry in `backend/dynamic-renderer.js` to explicitly map pages to their server-side logic modules. This avoids dynamic imports and filesystem scanning for better predictability and simpler bundling.
    - **Delimiters**: Uses standard EJS tags (`<%- %>`) for runtime logic.
    - **Helpers**: Injects a `dynamic(key)` helper to render async components defined in handlers.

## Security & Gating

- **Stateless Gating**: Protection for sensitive pages (like Guestbook) is implemented without cookies or sessions. The server verifies a Cloudflare Turnstile token on every request for gated pages.
- **Full API Protection**: All endpoints under `/api` require a valid Turnstile token.
- **Input Sanitization**: Guestbook entries are sanitized using `validator` (trim/escape) in `backend/google-sheets.js` before storage. Entries are carefully unescaped on read to allow safe display of content.
- **Limits**: Guestbook enforces character limits on names (50 chars) and messages (500 chars) both on the client and server.
- **Content Security Policy (CSP)**: Strict headers are enforced in `server.js` to allow only trusted scripts and frames.

## Key Files

- `site.config.js`: Main configuration and site data.
- `server.js`: Development server and production API proxy.
- `build.js`: Static site build script.
- `backend/static-renderer.js`: Core static EJS rendering logic.
- `backend/dynamic-renderer.js`: Runtime dynamic content processing.
- `backend/google-sheets.js`: Google Sheets API integration.
- `pages/guestbook/guestbook.server.js`: Guestbook specific backend logic.
