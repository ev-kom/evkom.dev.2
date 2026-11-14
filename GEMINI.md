# evkom.dev

Personal portfolio site: Express 5 server, custom posthtml static-site generator, plain HTML/CSS/JS, guestbook behind Cloudflare Turnstile.

Start with [README.md](README.md) for setup and commands. Details are in `.agent/docs/`. Read only what the task needs.

- [workflows.md](.agent/docs/workflows.md): add a page, styles, dynamic content; tests; dependencies; checks after a deploy.
- [architecture.md](.agent/docs/architecture.md): renderer, registries, render modes, routing.
- [security.md](.agent/docs/security.md): captcha gate, session token, validation, rate limits, headers, known limits.

## Hard rules

- Never read `.env`. Only `.env.test` (dummy values) may be read.
- Run the server with `node --env-file=<file> server.js` (`npm run dev` does this and also adds `--dev`, which skips the captcha check when the secret is missing), because the app does not load `.env` itself.
- Write integration tests only, in `test/integration.test.js`. No unit tests.
- Do not commit or push unless asked. A push to `main` deploys the site.
