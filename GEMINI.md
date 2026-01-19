# evkom.dev (Top Level)

> **Tech**: Node.js, Custom SSG, Vanilla JS/CSS.
> **Vibe**: Retro 2000s, Dithered, Pixelated.

## ⚡ Quick Start

- `npm run dev` -> localhost:8000 (JIT Render)
- `npm run build` -> dist/ (Static Gen)
- `npm start` -> localhost:3000 (Prod Serve)

## 🗺️ Project Map

| Path           | Purpose                                                 |
| -------------- | ------------------------------------------------------- |
| `pages/`       | HTML Entry points (one folder per page).                |
| `shared/`      | Reusable HTML partials (`<x-include>`).                 |
| `styles/`      | CSS files. **Must be inlined**.                         |
| `backend/`     | SSG Engine (`renderer.js`) & Routing (`registries.js`). |
| `.agent/docs/` | **Detailed Documentation (See below)**.                 |

## 📚 Documentation (Progressive Disclosure)

Read these ONLY if relevant to your task.

- **[workflows.md](.agent/docs/workflows.md)**: **Read first**. How to add pages, style components, and write logic.
- **[architecture.md](.agent/docs/architecture.md)**: Deep dive into the custom SSG renderer and tags.
- **[security.md](.agent/docs/security.md)**: Auth flows, Turnstile, and Zod validation.
