import express, { json } from 'express';
import rateLimit from 'express-rate-limit';
import { readFile } from 'fs/promises';
import { join } from 'path';

import { processDynamicContent } from './backend/dynamic-renderer.js';
import { appendGuestbookMessage } from './backend/google-sheets.js';
import {
  getError500,
  renderStaticPage,
  safeResolvePageName,
} from './backend/static-renderer.js';

const app = express();
const IS_DEV = process.argv.includes('--dev');
const PORT = process.env.PORT || (IS_DEV ? 8000 : 3000);

const DIST_DIR = join(import.meta.dirname, 'dist');
const PUBLIC_DIR = join(import.meta.dirname, 'public');

console.log(
  `Starting server in ${IS_DEV ? 'DEVELOPMENT' : 'PRODUCTION'} mode on port ${PORT}...`
);

// PARSE JSON BODIES (for API)
app.use(json());

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
    const name = req.body.name;
    const message = req.body.message;

    if (!name || !message) {
      return res.status(400).json({ error: 'Name and message are required' });
    }

    if (name.length > 30) {
      return res
        .status(400)
        .json({ error: 'Name must be 30 characters or less' });
    }

    if (message.length > 2000) {
      return res
        .status(400)
        .json({ error: 'Message must be 2000 characters or less' });
    }

    await appendGuestbookMessage(name, message);
    res.json({ success: true });
  } catch (err) {
    console.error('Guestbook Post Error:', err);
    res.status(500).json({ error: 'Failed to post message' });
  }
});

// HTML Handling Middleware (Dev & Prod)
// Intercepts .html requests or root to render page
app.use(async (req, res, next) => {
  // 1. Resolve Page Name
  const pageName = safeResolvePageName(req.path);

  if (!pageName) {
    return next();
  }

  // 2. Fetch/Render Static HTML
  let staticHtml;

  if (IS_DEV) {
    // DEV: Render from source using EJS
    staticHtml = await renderStaticPage(pageName);
  } else {
    // PROD: Serve from dist/ (pre-built)
    try {
      staticHtml = await readFile(join(DIST_DIR, `${pageName}.html`), 'utf8');
    } catch {
      console.error('Failed to load static HTML:', pageName);
      return res.status(500).send(getError500());
    }
  }

  // 3. Dynamic Phase
  try {
    const finalHtml = await processDynamicContent(staticHtml, {
      pageName,
    });
    res.send(finalHtml);
  } catch (e) {
    console.error('Dynamic Render Error:', e);
    return res.status(500).send(getError500());
  }
});

// STATIC ASSETS HANDLING
if (IS_DEV) {
  // DEV MODE: Serve public folder
  app.use(express.static(PUBLIC_DIR));
} else {
  // PROD MODE: Serve form dist (processed assets)
  app.use(express.static(DIST_DIR));
}

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  if (IS_DEV) console.log(`Open http://localhost:${PORT}`);
});
