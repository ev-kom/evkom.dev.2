import { runBuild } from './build.js';

runBuild().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
