// Start script that runs TypeScript using tsx
// This wrapper ensures tsx runs correctly even if npx has permission issues
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverPath = join(__dirname, 'src', 'server.ts');

// Try to find and use tsx CLI via node_modules
const tsxCliPath = join(__dirname, 'node_modules', 'tsx', 'dist', 'cli.mjs');

if (existsSync(tsxCliPath)) {
  // Use tsx CLI directly via Node
  const child = spawn('node', [tsxCliPath, serverPath], {
    stdio: 'inherit',
    env: process.env,
    cwd: __dirname,
  });
  
  child.on('exit', (code) => process.exit(code || 0));
  child.on('error', (err) => {
    console.error('[ERROR] Failed to start tsx:', err);
    process.exit(1);
  });
} else {
  console.error('[ERROR] tsx not found. Please run: npm install');
  process.exit(1);
}

