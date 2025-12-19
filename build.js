import { cp, mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { PAGES, renderStaticPage } from './backend/static-renderer.js';

const STATIC_DIRS = ['public'];
const DIST_DIR = join(process.cwd(), 'dist');

async function build() {
  console.log('Starting build...');

  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });

  // Render pages
  for (const page of PAGES) {
    console.log(`Rendering ${page}...`);
    const html = await renderStaticPage(page);
    await writeFile(join(DIST_DIR, `${page}.html`), html);
  }

  // Copy static assets
  for (const dir of STATIC_DIRS) {
    console.log(`Copying ${dir}...`);
    // Copy contents of public directly to dist
    await cp(join(process.cwd(), dir), DIST_DIR, { recursive: true });
  }

  console.log('Build complete.');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
