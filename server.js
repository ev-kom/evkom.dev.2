import express, { json } from 'express';
import rateLimit from 'express-rate-limit';
import { basename, extname, join } from 'path';

import { verifySessionToken } from './backend/captcha.js';
import { appendGuestbookMessage } from './backend/google-sheets.js';
import { PAGE_REGISTRY } from './backend/registries.js';
import { renderDev, renderProd } from './backend/renderer.js';
import { siteConstants } from './site.config.js';

const app = express();
const IS_DEV = process.argv.includes('--dev');
if (!IS_DEV) {
  console.log = () => {};
}
const PORT = process.env.PORT || (IS_DEV ? 8000 : 3000);

const DIST_DIR = join(import.meta.dirname, 'dist');
const PUBLIC_DIR = join(import.meta.dirname, 'public');

console.log(
  `Starting server in ${IS_DEV ? 'DEVELOPMENT' : 'PRODUCTION'} mode on port ${PORT}...`
);

// PARSE JSON BODIES (for API)
app.use(json());
app.use(express.urlencoded({ extended: true }));

app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
  })
);

// Guestbook API POST route
app.post('/api/guestbook', async (req, res) => {
  try {
    const token = req.body.sessionToken;
    if (!verifySessionToken(token)) {
      return res.status(403).json({ error: 'SESSION EXPIRED. PLEASE RELOAD.' });
    }

    const name = req.body.name;
    const message = req.body.message;

    if (!name || !message) {
      return res
        .status(400)
        .json({ error: 'DATA CORRUPTION: MISSING INPUT FIELDS.' });
    }

    if (name.length > 30) {
      return res
        .status(400)
        .json({ error: 'BUFFER OVERFLOW: NAME EXCEEDS 30 BYTES.' });
    }

    if (message.length > 2000) {
      return res
        .status(400)
        .json({ error: 'BUFFER OVERFLOW: MESSAGE EXCEEDS 2000 BYTES.' });
    }

    await appendGuestbookMessage(name, message);
    res.json({ success: true });
  } catch (err) {
    console.error('Guestbook Post Error:', err);
    res.status(500).json({ error: 'SYSTEM FAILURE: WRITE OPERATION ABORTED.' });
  }
});

import { PAGE_SCHEMAS } from './backend/schemas.js';

// Root Redirect
app.use((req, res, next) => {
  if (req.path === '/') {
    return res.redirect('/index.html');
  }
  next();
});

// HTML Handling Middleware (Dev & Prod)
// Intercepts .html requests or root to render page
app.use(async (req, res, next) => {
  const registryKey = safeResolvePageRegistryKey(req.path);
  if (!registryKey) {
    return next();
  }

  // Security: Validate and strip inputs
  const rawParams = { ...req.query, ...req.body };
  const schema = PAGE_SCHEMAS[registryKey] || PAGE_SCHEMAS.default;
  const validatedParams = schema.parse(rawParams);

  let html;

  const renderParams = {
    ...validatedParams,
    ...siteConstants,
    siteKey: process.env.TURNSTILE_SITE_KEY,
  };

  try {
    if (IS_DEV) {
      html = await renderDev(registryKey, renderParams);
    } else {
      html = await renderProd(registryKey, renderParams);
    }
  } catch (err) {
    console.error('Render Error:', err);
    return next(err);
  }

  if (!html) {
    return next();
  }

  res.send(html);
});

// STATIC ASSETS HANDLING
if (IS_DEV) {
  // DEV MODE: Serve public folder
  app.use(express.static(PUBLIC_DIR));
} else {
  // PROD MODE: Serve form dist (processed assets)
  app.use(express.static(DIST_DIR));
}

// 404 Catch-all Middleware
app.use((req, res) => {
  if (req.path === '/404.html') {
    // Avoid infinite loop if 404 page itself fails or is missing (though should be caught by registry above)
    return res.status(404).send('<h1>404 Not Found (Recursive)</h1>');
  }
  res.redirect('/404.html');
});

// 500 Error Handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  if (req.path === '/500.html') {
    // Avoid infinite loop if 500 page itself fails
    return res
      .status(500)
      .send('<h1>500 Internal Server Error (Recursive)</h1>');
  }
  res.redirect('/500.html');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  if (IS_DEV) console.log(`Open http://localhost:${PORT}`);
});

const sanitizePath = (path) => {
  try {
    const sanitized = String(path || '/').trim();
    return decodeURIComponent(sanitized);
  } catch {
    return null;
  }
};

/**
 * Resolves a URL path to a page registry key.
 *
 * @param {string} path - The request path (e.g. '/', '/guestbook')
 * @returns {string|null} The resolved registry key, or null if should be skipped.
 */
export function safeResolvePageRegistryKey(path) {
  const reqPath = sanitizePath(path);
  if (!reqPath) return null;

  const isRoot = reqPath === '/';
  const ext = extname(reqPath);

  // If it has an extension that is NOT .html, it's an asset (or invalid)
  if (!isRoot && ext && ext !== '.html') {
    return null;
  }

  const pageName = isRoot ? 'page/index' : `page/${basename(reqPath, '.html')}`;

  if (PAGE_REGISTRY[pageName]) {
    return pageName;
  }

  return null;
}
