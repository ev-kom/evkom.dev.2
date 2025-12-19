import { render } from 'ejs';
import { readFile } from 'fs/promises';
import { basename, extname, join, resolve } from 'path';
import { siteConstants } from '../site.config.js';

export const PAGES = ['index', 'cv', 'manifest', 'guestbook', '404', '500'];

const ROOT_DIR = resolve(process.cwd());
const PAGES_DIR = join(ROOT_DIR, 'pages');

const TURNSTILE_SITE_KEY =
  process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA';

export async function getError500() {
  try {
    const error500Path = join(PAGES_DIR, '500', '500.html');
    return await readFile(error500Path, 'utf8');
  } catch (e) {
    console.error('Failed to load 500 page:', e);
    return '<h1>500 Internal Server Error</h1>';
  }
}

export async function getError404() {
  try {
    const error404Path = join(PAGES_DIR, '404', '404.html');
    return await readFile(error404Path, 'utf8');
  } catch (e) {
    console.error('Failed to load 404 page:', e);
    return '<h1>404 Page Not Found</h1>';
  }
}

const sanitizePath = (path) => {
  try {
    const sanitized = String(path || '/').trim();
    return decodeURIComponent(sanitized);
  } catch {
    return '/';
  }
};

/**
 * Resolves a URL path to a page name.
 * Returns null if the path is an asset or invalid.
 *
 * @param {string} path - The request path (e.g. '/', '/guestbook')
 * @returns {string|null} The resolved page name, or null if should be skipped.
 */
export function safeResolvePageName(path) {
  const reqPath = sanitizePath(path);
  const isRoot = reqPath === '/';
  const ext = extname(reqPath);

  // If it has an extension that is NOT .html, it's an asset (or invalid)
  if (!isRoot && ext && ext !== '.html') {
    return null;
  }

  const pageName = isRoot ? 'index' : basename(reqPath, '.html');

  if (!PAGES.includes(pageName)) {
    return null;
  }

  return pageName;
}

/**
 * Renders a static page by name.
 * Handles file reading, 404s, and EJS rendering.
 *
 * @param {string} pageName - The name of the page (e.g., 'index', 'cv')
 * @returns {Promise<string>} The rendered HTML or 404 error page.
 */
export async function renderStaticPage(pageName) {
  pageName = safeResolvePageName(pageName);

  if (!pageName) {
    return await getError404();
  }

  const templatePath = join(PAGES_DIR, pageName, `${pageName}.html`);

  let templateContent = '';

  try {
    templateContent = await readFile(templatePath, 'utf8');
  } catch (err) {
    return await getError500();
  }

  try {
    return render(
      templateContent,
      {
        ...siteConstants,
        TURNSTILE_SITE_KEY,
        dynamic: (key) => `<%- dynamic('${key}') %>`,
      },
      { filename: templatePath, root: ROOT_DIR }
    );
  } catch (e) {
    console.error('EJS Static Render Error:', e);
    return await getError500();
  }
}
