# Workflows

How to work in this repo. For the commands and environment variables, see the [README](../../README.md).

## Secrets

Never read, print or commit `.env`. Local work needs a real `.env`, and the dev server loads it with `--env-file` (`npm run dev` does this). Only `.env.test` may be read. It holds dummy values and is safe to commit.

## Add a page

1. Create `pages/<name>/<name>.html`. To get the layout, copy an existing page such as [`pages/cv/cv.html`](../../pages/cv/cv.html), which includes the header, footer and sidebars with `<x-include>`.
2. Register it in `PAGE_REGISTRY` in [`backend/registries.js`](../../backend/registries.js) as `'page/<name>': 'pages/<name>/<name>.html'`. The page is then served at `/<name>` and `/<name>.html`. In production it is served only after `npm run build`, because production reads `dist/page/<name>.html`.
3. Add its URL to [`public/sitemap.xml`](../../public/sitemap.xml) (the list is written by hand) and a link where it should appear, for example [`shared/header.html`](../../shared/header.html).
4. If the page takes user input, add a zod schema `PAGE_SCHEMAS['page/<name>']` in [`backend/schemas.js`](../../backend/schemas.js). Without one, the page receives no input.

Use plain HTML, CSS and browser JS, normal `<a>` links and no client router.

## Add styles or scripts

Put CSS in `styles/<name>.css` and include it with `<x-inline-css src="<name>.css"></x-inline-css>`. Use the tokens in `styles/variables.css` (colors, spacing) and add a missing value there instead of hard-coding it. Browser JS goes in `scripts/` and is included with `<x-inline-js>`. Inlining keeps pages free of render-blocking requests.

## Add dynamic content

1. Write an async handler (see [`pages/guestbook/guestbook.server.js`](../../pages/guestbook/guestbook.server.js)). It receives the page params and a `render(key, params)` function and returns HTML.
2. Add the partials (page fragments) it renders to `PAGE_REGISTRY` and the handler to `DYNAMIC_REGISTRY`.
3. Place `<x-dynamic src="<key>"></x-dynamic>` in the template.

See [architecture](architecture.md) for how the modes treat these tags.

## Tests

Tests are integration tests only, in one file: [`test/integration.test.js`](../../test/integration.test.js). There are no unit tests. Each test sends real HTTP requests to the production server.

`npm test` runs `node --test`. The test file builds `dist/`, then starts `node --env-file=.env.test server.js` on a random free port. It starts further server instances when a test needs different settings, such as another working directory or no Turnstile secret. The Turnstile secret in `.env.test` is a dummy, but the server still calls Cloudflare `siteverify`, so tests marked `(network)` need internet access. No Google credentials are set, so a valid guestbook post passes validation and then ends with a 500 from the missing Sheets client. Tests treat that 500 as success of the earlier steps.

To add a case:

1. Add a `test(...)` in the matching `describe` block of the file, or a new `describe` that starts its own server with `startServer`.
2. Use the helpers in the file: `postJson` and `postPage` for requests, `getToken` for a session token from the dummy captcha, `mintToken` for a token with a chosen age.
3. Assert on the status code and on the body or headers. Start the test name with `(network)` if it calls Cloudflare.
4. Run `npm test` and `npm run lint`.

## Dependencies

- Prefer a safe, popular and maintained library, or a platform built-in, over custom code.
- Before adding a package, run `npm view <pkg>` (maintenance, size, dependencies), `npm audit` and `npm audit signatures`.
- Keep `npm audit` clean.
- Use `@googleapis/sheets`, not the full `googleapis` package.

## After a deploy

Check with `curl` against the live site:

- An unknown path, such as `/nope`, returns status 404.
- Partials return 404, for example `/shared/header.html` and `/guestbook/content.html`.
- A page response carries the headers in [security](security.md): `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy` with `frame-ancestors`, and `Referrer-Policy`, and no `X-Powered-By`.
- The rate limiter warns only after a client hits the limit. To trigger it, send 31 POSTs to `/guestbook.html` from one IP, for example `for i in $(seq 31); do curl -s -o /dev/null -X POST https://<host>/guestbook.html; done`. The 31st answers 429 and writes one `Rate limit: key=...` line to the runtime logs. `key` must be the IP of the machine that ran `curl`. If it is the proxy's IP, not the visitor's, the client key is wrong.
