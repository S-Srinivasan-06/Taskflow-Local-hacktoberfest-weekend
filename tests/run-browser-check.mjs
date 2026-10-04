import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

const browsers = process.platform === 'win32' ? [
  join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
] : [];
const browser = browsers.find(existsSync);
if (!browser) throw new Error('An existing Chrome or Edge installation is required for this Windows UI check');

try {
  const response = await fetch('http://127.0.0.1:1420/tests/desktop.html');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
} catch {
  throw new Error('Start npm run dev before running npm run test:ui');
}

const artifacts = resolve('tests/artifacts');
mkdirSync(artifacts, { recursive: true });

function runBrowser(args) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(browser, args, { windowsHide: true });
    let output = '';
    let errors = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Headless browser timed out')); }, 45_000);
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { errors += chunk; });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`Browser exited with ${code}: ${errors.slice(-1500)}`));
      else resolveResult(output);
    });
  });
}

for (const [name, query] of [['manual', 'smoke'], ['empty', 'smoke&empty'], ['recovery', 'smoke&fail_load']]) {
  const profile = mkdtempSync(join(tmpdir(), 'taskflow-browser-'));
  try {
    const output = await runBrowser([
      '--headless', '--disable-gpu', '--disable-background-networking', '--disable-component-update',
      '--disable-extensions', '--disable-sync', '--no-first-run', '--no-default-browser-check',
      '--window-size=620,760', '--virtual-time-budget=15000', `--user-data-dir=${profile}`,
      `--screenshot=${join(artifacts, `${name}.png`)}`, '--dump-dom',
      `http://127.0.0.1:1420/tests/desktop.html?${query}`,
    ]);
    const report = output.match(/<output id="browser-check"[^>]*data-result="(pass|fail)"[^>]*>([\s\S]*?)<\/output>/);
    if (!report || report[1] !== 'pass') throw new Error(`${name}: ${report?.[2] ?? 'The browser produced no test result'}`);
    console.log(`PASS ${name}: ${report[2]}`);
  } finally {
    // Only delete the verified temporary profile created for this check.
    const resolvedProfile = resolve(profile);
    if (dirname(resolvedProfile) !== resolve(tmpdir()) || !basename(resolvedProfile).startsWith('taskflow-browser-')) {
      throw new Error('Unexpected browser profile cleanup path');
    }
    rmSync(resolvedProfile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}
