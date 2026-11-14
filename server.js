import express, { json } from 'express';
import { STATUS_CODES } from 'node:http';
import { join } from 'path';

import compression from 'compression';
import helmet from 'helmet';
import { verifySessionToken } from './backend/captcha.js';
import { appendGuestbookMessage } from './backend/google-sheets.js';
import { IS_DEV } from './backend/mode.js';
import { createLimiter } from './backend/rate-limit.js';
import { PAGE_REGISTRY } from './backend/registries.js';
import { renderDev, renderProd } from './backend/renderer.js';
import { guestbookPostSchema, PAGE_SCHEMAS } from './backend/schemas.js';
import { siteConstants } from './site.config.js';

const app = express();
// A trailing slash is a 404, not a page (relative links break under it). Must precede the first app.use.
app.set('strict routing', true);

// Set explicitly below: frame denial (CSP frame-ancestors, X-Frame-Options), Referrer-Policy.
// Helmet defaults set nosniff and remove X-Powered-By. Its other harmless defaults stay on:
// X-DNS-Prefetch-Control, X-Download-Options, X-Permitted-Cross-Domain-Policies,
// X-XSS-Protection: 0. No full CSP (inline scripts/styles). HSTS, cross-origin headers and
// Origin-Agent-Cluster are off on purpose.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src':
          helmet.contentSecurityPolicy.dangerouslyDisableDefaultSrc,
        frameAncestors: ["'none'"],
      },
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
    originAgentCluster: false,
  })
);
app.use(compression());

if (!IS_DEV) {
  console.log = () => {};
}
const PORT = process.env.PORT || (IS_DEV ? 8000 : 3000);

const DIST_DIR = join(import.meta.dirname, 'dist');
const PUBLIC_DIR = join(import.meta.dirname, 'public');

console.log(
  `Starting server in ${IS_DEV ? 'DEVELOPMENT' : 'PRODUCTION'} mode on port ${PORT}...`
);

// RATE LIMITS (separate stores): the JSON API, and POST page routes (captcha solve / token renewal).
// They run before the body parser so oversized and malformed bodies count too.
app.use('/api', createLimiter({ limit: 50 }));
app.use(
  createLimiter({
    limit: 30,
    skip: (req) =>
      req.method !== 'POST' ||
      req.path === '/api' ||
      req.path.startsWith('/api/'),
  })
);

// PARSE JSON BODIES (for API)
app.use(json({ limit: '10kb' }));

// Guestbook API POST route
app.post('/api/guestbook', async (req, res) => {
  try {
    // Validate the shape first, so a non-string token is a 400, not a 500.
    const parsed = guestbookPostSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { name, message, sessionToken } = parsed.data;

    if (!(await verifySessionToken(sessionToken))) {
      return res.status(403).json({ error: 'SESSION EXPIRED. PLEASE RELOAD.' });
    }

    await appendGuestbookMessage(name, message);
    res.json({ success: true });
  } catch (err) {
    console.error('Guestbook Post Error:', err);
    res.status(500).json({ error: 'SYSTEM FAILURE: WRITE OPERATION ABORTED.' });
  }
});

// Quiet 404 for DevTools/browser metadata requests (no 404 page rendering)
app.use('/.well-known', (req, res) => res.status(404).end());

app.get('/', (req, res) => res.redirect('/index.html'));

const render = (key, params) =>
  (IS_DEV ? renderDev : renderProd)(key, {
    ...params,
    ...siteConstants,
    siteKey: process.env.TURNSTILE_SITE_KEY,
  });

// Renders the 404/500 page in place. If that fails too, a plain-text body (no recursion).
async function sendErrorPage(res, status) {
  try {
    const html = await render(`page/${status}`);
    if (html) return res.status(status).send(html);
    console.error('Error page failed:', new Error('empty error page'));
  } catch (err) {
    console.error('Error page failed:', err);
  }
  res.status(status).type('text').send(STATUS_CODES[status]);
}

// PAGES: exactly `/<name>` or `/<name>.html`. 404/500 are error pages, not routes.
async function pageHandler(req, res, next) {
  const key = `page/${req.params.name}`;
  if (!PAGE_REGISTRY[key] || key === 'page/404' || key === 'page/500') {
    return next();
  }

  // Validate and strip inputs; invalid input (e.g. a repeated query param) renders as if empty.
  const schema = PAGE_SCHEMAS[key] || PAGE_SCHEMAS.default;
  const input = { ...req.query, ...req.body };
  // GET/HEAD are not rate-limited, and a Turnstile token costs a Cloudflare call.
  if (req.method !== 'POST') delete input['cf-turnstile-response'];
  const parsed = schema.safeParse(input);
  const html = await render(key, parsed.success ? parsed.data : {});
  if (!html) {
    return next();
  }
  res.send(html);
}
app.route('/:name{.html}').get(pageHandler).post(pageHandler);

// STATIC ASSETS: dev serves public/, prod serves the built dist/. `.html` is never served
// (dist/ also holds build partials), and no directory index.
const staticFiles = express.static(IS_DEV ? PUBLIC_DIR : DIST_DIR, {
  index: false,
});
// express.static decodes the path itself, so test the decoded one (`%2ehtml` must not slip through).
const isHtml = (path) => {
  try {
    return /\.html$/i.test(decodeURIComponent(path));
  } catch {
    return true;
  }
};
app.use((req, res, next) =>
  isHtml(req.path) ? next() : staticFiles(req, res, next)
);

app.use((req, res) => sendErrorPage(res, 404));

// Error handler (Express needs all four arguments to treat this as an error handler)
app.use(async (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const clientError = err.status >= 400 && err.status < 500;
  // Body-parser failures on the API (too large, bad JSON): JSON with the parser's 4xx status.
  if (req.path.startsWith('/api') && clientError) {
    return res.status(err.status).json({
      error:
        err.type === 'entity.too.large'
          ? 'BUFFER OVERFLOW: REQUEST EXCEEDS 10 KB.'
          : 'DATA CORRUPTION: MALFORMED REQUEST.',
    });
  }
  // Same on page routes: keep the 4xx status with a minimal body.
  if (clientError) {
    return res.status(err.status).type('text').send(STATUS_CODES[err.status]);
  }
  console.error('Server Error:', err);
  await sendErrorPage(res, 500);
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  if (IS_DEV) console.log(`Open http://localhost:${PORT}`);
});
