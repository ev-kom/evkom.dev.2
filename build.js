import { cp, rm, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { build } from './backend/renderer.js';
import { bundleCss } from './backend/css-bundler.js';

const STATIC_DIRS = ['public'];

export async function generateBundledCss(distDir) {
  console.log('Generating bundled CSS...');
  const bundledCssContent = await bundleCss();
  const cssDist = join(distDir, 'css');
  await mkdir(cssDist, { recursive: true });
  await writeFile(join(cssDist, 'bundled.css'), bundledCssContent);
}

export async function runBuild(distDir = './dist') {
  console.log('Starting build...');

  await rm(distDir, { recursive: true, force: true });

  // Render all static content
  await build(distDir);

  // Copy static assets
  for (const dir of STATIC_DIRS) {
    console.log(`Copying ${dir}...`);
    // Copy contents of public directly to dist
    await cp(join(import.meta.dirname, dir), distDir, { recursive: true });
  }

  await generateBundledCss(distDir);

  console.log('Build complete.');
}
