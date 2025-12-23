import { cp, rm } from 'fs/promises';
import { join } from 'path';
import { build } from './backend/renderer.js';

const STATIC_DIRS = ['public'];

async function runBuild(distDir = './dist') {
  console.log('Starting build...');

  await rm(distDir, { recursive: true, force: true });

  // Render all static content
  await build(distDir);

  // Copy static assets
  for (const dir of STATIC_DIRS) {
    console.log(`Copying ${dir}...`);
    // Copy contents of public directly to dist
    await cp(join(process.cwd(), dir), distDir, { recursive: true });
  }

  console.log('Build complete.');
}

runBuild().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
