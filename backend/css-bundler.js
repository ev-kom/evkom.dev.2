import fs from 'node:fs/promises';
import path from 'node:path';

const CORE_ORDER = [
  'variables.css',
  'base.css',
  'layout.css',
  'main-content.css',
  'header.css',
  'sidebar.css',
  'footer.css',
  'windows-popup.css',
];

export async function bundleCss() {
  const cssDir = path.join(process.cwd(), 'public', 'css');
  let bundle = '/* Bundled CSS */\n';

  const files = await fs.readdir(cssDir);

  const cssFiles = files.filter(
    (file) => file.endsWith('.css') && file !== 'bundled.css'
  );

  // Split into core and other files for simpler sorting
  const coreFiles = CORE_ORDER.filter((f) => cssFiles.includes(f));
  const otherFiles = cssFiles.filter((f) => !CORE_ORDER.includes(f)).sort();

  for (const file of [...coreFiles, ...otherFiles]) {
    const content = await fs.readFile(path.join(cssDir, file), 'utf-8');
    bundle += `\n/* --- ${file} --- */\n`;
    bundle += content;
  }

  return bundle;
}
