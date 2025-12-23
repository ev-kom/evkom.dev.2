# evkom.dev

Retro 2000s portfolio. Custom Node.js SSG. No frameworks.

### Commands

- `npm run dev` -- Auto-assembly (localhost:8000)
- `npm run build` -- Generate static dist/
- `node --env-file=.env server.js --dev` -- Manual debug start

### Architecture

**Core `backend/renderer.js`**

- **Unified Engine**: `renderDev` (JIT) and `renderProd` (hydration) share logic.
- **Registries** (`backend/registries.js`):
  - `PAGE_REGISTRY`: URL path -> File path.
  - `DYNAMIC_REGISTRY`: `<x-dynamic>` tag -> Handler function.
- **Tags**:
  - `<x-include src="shared/header">`: Static partial.
  - `<x-dynamic src="guestbook/content">`: Runtime dynamic component.
  - `<x-var name="title">`: Variable injection.

### Dev Workflow

**Adding a Page**

1.  **Register**: Add key to `PAGE_REGISTRY` in `backend/registries.js` (e.g. `'page/about': 'pages/about/about.html'`).
2.  **Create**: Make the file `pages/about/about.html`.

**Adding Logic**

1.  **Register**: Add key to `DYNAMIC_REGISTRY`.
2.  **Implement**: Handler in `pages/about/about.server.js`.
3.  **Embed**: Use `<x-dynamic src="key">` in HTML.

### Constraints & Conventions

- **Strict Separation**:
  - HTML for structure.
  - CSS for presentation. No inline styles.
  - JS for behavior. No `<script>` tags in body.
- **Retro CSS**:
  - Use `var(--pixel-grey-1)` from `variables.css`.
  - Use `border: 2px solid black`.
  - Font: `Space Mono`.

### Security

- **Guestbook**: Cloudflare Turnstile -> Session Token (HMAC) -> Submission.
- **Env**: `.env` requires `SESSION_SECRET_KEY` and Turnstile keys.
