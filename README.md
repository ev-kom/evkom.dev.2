# evkom.dev

Personal portfolio site of Egor Komarov, in a retro 2000s style. It is an Express 5 server with a small custom static-site generator (posthtml). The pages use plain HTML, CSS and browser JavaScript. The guestbook is stored in a Google Sheet and protected by Cloudflare Turnstile.

## Run it

Use the Node.js version in [`.nvmrc`](.nvmrc) (the same range is in `engines` in [`package.json`](package.json)).

Create a `.env` file in the project root. Never commit it. [`.env.example`](.env.example) lists the names:

| Variable                                     | Purpose                                                                            |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile widget key and server-side secret.                            |
| `SESSION_SECRET_KEY`                         | Signing key of the guestbook session token.                                        |
| `GOOGLE_SERVICE_ACCOUNT`                     | Service account credentials as one JSON string.                                    |
| `GOOGLE_SHEET_ID`, `GOOGLE_SHEET_NAME`       | Spreadsheet and tab that hold the guestbook (columns A to C: time, name, message). |

| Command          | What it does                                                                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`    | `node --env-file=.env server.js --dev`. Renders pages on each request. Listens on port 8000.                                                                           |
| `npm run build`  | Renders every page and partial into `dist/` and copies `public/` into it. A partial is a page fragment, such as the header, that is built but never served on its own. |
| `npm start`      | `node server.js`. Serves `dist/` on port 3000. Reads the environment from the process, not `.env`.                                                                     |
| `npm test`       | Integration tests. See [workflows](.agent/docs/workflows.md#tests).                                                                                                    |
| `npm run lint`   | ESLint.                                                                                                                                                                |
| `npm run format` | Prettier, writes files in place.                                                                                                                                       |

`PORT` overrides the default port.

To run the production server locally, run `npm run build` first, then `node --env-file=.env server.js`. `dist/` is gitignored, so on a fresh clone every page answers 404 until the build has run.

Without real credentials, run `node --env-file=.env.test server.js` after the build. It uses Cloudflare's dummy Turnstile keys, so the captcha gate works (the dummy secret still calls Cloudflare `siteverify`, so it needs internet). A guestbook post ends in a 500 because there are no Google credentials. This is enough to run and test the rest of the site.

## Deploy

A push to `main` deploys automatically to DigitalOcean App Platform, behind Cloudflare. The build command is `npm run build` and the run command is `npm start`.

## More

- [architecture](.agent/docs/architecture.md): how pages are rendered and routed.
- [security](.agent/docs/security.md): the guestbook gate, tokens, validation, rate limits and headers, with their limits.
- [workflows](.agent/docs/workflows.md): how to add a page, run the tests and add a dependency.
