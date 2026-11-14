# Architecture

The site is a custom static-site generator built on posthtml, plus an Express 5 server. Pages are plain HTML files. Includes and inline CSS/JS are resolved once at build time. In production every page is parsed again on each request to fill `{{var}}`; only the guestbook also runs `<x-dynamic>` handlers.

## Layout

| Path                     | Content                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `pages/<name>/<name>.html` | One page per folder. The guestbook folder also holds its partials and `guestbook.server.js`. |
| `shared/`                | Partials used by several pages (header, footer, sidebars). A partial is a page fragment that is built into `dist/` but never served on its own. |
| `styles/`, `scripts/`    | CSS and browser JS. They are inlined into the HTML, never linked.                             |
| `public/`                | Static files (images, fonts, `robots.txt`, `sitemap.xml`). Copied into `dist/` by the build.  |
| `backend/`               | Renderer, registries, schemas, captcha, Google Sheets, rate limiter.                          |
| `site.config.js`         | Site constants (`linkedin`, `github`, link targets for credits). The server passes them to every render, so templates read them as `{{linkedin}}`, `{{github}}`. |
| `server.js`, `build.js`  | HTTP server and build entry. `run-build.js` runs the build for `npm run build`.               |

[`backend/registries.js`](../../backend/registries.js) is the list of everything the renderer can load:

- `PAGE_REGISTRY` maps a registry key (the name of an entry, such as `page/cv`, `shared/header` or `guestbook/form`) to a source file. Pages, shared partials and guestbook partials all live here.
- `DYNAMIC_REGISTRY` maps the key of an `<x-dynamic>` tag to an async handler.

## Templating

The renderer ([`backend/renderer.js`](../../backend/renderer.js)) parses HTML with posthtml and handles these tags and syntax:

- `<x-include src="key">` inserts the partial with that registry key.
- `<x-dynamic src="key">` calls the handler with that key in `DYNAMIC_REGISTRY`. The handler returns HTML and can render partials with the `render` function it receives.
- `<x-inline-css src="file.css">` and `<x-inline-js src="file.js">` inline a file from `styles/` or `scripts/`, minified (clean-css, terser).
- `{{var}}` (also in attribute values) and `<x-var name="var">` insert a parameter. Values are HTML-escaped with `validator.escape`. A missing parameter becomes an empty string.

The renderer stops a runaway template: a total time limit, a repeat limit for one key in a chain of includes, and a size limit on input HTML. The values are in [`backend/renderer.js`](../../backend/renderer.js): `MAX_INPUT_SIZE` at the top of the file, and `MAX_TIME`, `WINDOW_SIZE` and `MAX_RECURRENCE` inside `RenderContext`.

## Render modes

| Mode   | Entry                     | Includes and inline assets | `{{var}}` and `<x-dynamic>`    |
| ------ | ------------------------- | -------------------------- | ------------------------------ |
| Dev    | `renderDev` (`--dev`)     | Resolved on each request   | Resolved on each request       |
| Build  | `build` (`npm run build`) | Resolved into `dist/`      | Stay as literal text in `dist/` and are filled in at request time |
| Prod   | `renderProd` (`npm start`) | Already in `dist/`        | Resolved on each request       |

The build writes every registry key to `dist/<key>.html`, so `dist/` also contains partials. Dev has no file watcher: it reads the source files again on each request, so a browser reload shows the change.

## Routing

All routes are in [`server.js`](../../server.js), in this order:

1. Security headers (helmet) and compression, then the two rate limiters and the JSON body parser. See [security](security.md).
2. `POST /api/guestbook`.
3. `/.well-known/*` answers 404 without a body.
4. `GET /` redirects to `/index.html`.
5. Pages: `/:name` and `/:name.html`, one path segment only, GET and POST. The name must be a page key in `PAGE_REGISTRY`. `404` and `500` are error pages and are not routes. Input is validated by the schema of the page.
6. Static files from `public/` (dev) or `dist/` (prod). Any path that ends in `.html`, also when URL-encoded, is never served from here, so build partials stay private. Directories have no index.
7. Everything else: the 404 page with status 404.

The 404 and 500 pages are rendered in place with their real status code, not redirected to. If rendering the error page fails, the server sends the status text as plain text. A body-parser error answers JSON on `/api` and plain text elsewhere, with the 4xx status of the error.

## Paths and logging

The renderer builds every path from the project root, not from the working directory, so the server can start from any directory. In production `console.log` is silenced. `console.warn` and `console.error` still print.
