# evkom.dev

Personal portfolio site: Express 5 server, custom posthtml static-site generator, plain HTML/CSS/JS, guestbook behind Cloudflare Turnstile.

Start with [README.md](README.md) for setup and commands. Details are in `.agent/docs/`. Read only what the task needs.

- [workflows.md](.agent/docs/workflows.md): add a page, styles, dynamic content; tests; dependencies; checks after a deploy.
- [architecture.md](.agent/docs/architecture.md): renderer, registries, render modes, routing.
- [security.md](.agent/docs/security.md): captcha gate, session token, validation, rate limits, headers, known limits.

## Layout

- `server.js`: Express app. `backend/`: renderer, registries, captcha, rate limits, schemas, Google Sheets client.
- `pages/`, `shared/`, `styles/`, `public/`, `scripts/`: page sources, partials, CSS, static assets, browser JS.
- `build.js`, `run-build.js`: the generator. `dist/` is its output (gitignored).
- `.agent/`: the one source for agent setup and docs. `claude-settings.json` (Claude Code deny rules) and `ignore` (ignore list) live here. `.claude/settings.json`, `.geminiignore` and `CLAUDE.md` are only links or one-line pointers to them. Edit the files in `.agent/`, not the links.
- `legacy/`: old material (gitignored). Not part of the site; do not edit.

## Setup

- Node 26 (`.nvmrc`, `engines` is `26.x`). Run `nvm use` in the project root.
- `npm run build`, `npm test`, `npm run lint`, `npm run format`. Run `npm run lint` and `npm test` before you report a change as done.
- Update dependencies with `npm outdated`, then `npm update` (or `npm install <pkg>@latest` for a major bump). Run `npm audit --omit=dev`, then the build and the tests.

## Hard rules

- Never read `.env`. Only `.env.test` (dummy values) may be read.
- Run the server with `node --env-file=<file> server.js` (`npm run dev` does this and also adds `--dev`, which skips the captcha check when the secret is missing), because the app does not load `.env` itself.
- Write integration tests only, in `test/integration.test.js`. No unit tests.
- Do not commit or push unless asked. A push to `main` deploys the site.
