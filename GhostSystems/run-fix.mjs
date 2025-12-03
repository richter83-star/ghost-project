// Wrapper script to run fix-shopify-products.ts
// Similar to start.mjs, ensures tsx runs correctly
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const scriptPath = join(__dirname, 'src', 'cli', 'fix-shopify-products.ts');

// Try to find and use tsx CLI via node_modules
const tsxCliPath = join(__dirname, 'node_modules', 'tsx', 'dist', 'cli.mjs');

if (existsSync(tsxCliPath)) {
  // Use tsx CLI directly via Node
  const child = spawn('node', [tsxCliPath, scriptPath], {
    stdio: 'inherit',
    env: process.env,
    cwd: __dirname,
  });

  child.on('exit', (code) => process.exit(code || 0));
  child.on('error', (err) => {
    console.error('[ERROR] Failed to run tsx:', err);
    process.exit(1);
  });
} else {
  console.error('[ERROR] tsx not found. Please run: npm install');
  process.exit(1);
}

