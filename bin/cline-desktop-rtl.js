#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { patch, unpatch } = require('../src/desktop-patch');
const { parsePE } = require('../src/pe');
const { discoverAssets, getMainCss } = require('../src/binary-patch');

const DEFAULT_EXE = path.join(process.env.LOCALAPPDATA || '', 'Cline', 'cline-app.exe');

function resolveExe(arg) {
  const exe = arg ? path.resolve(arg) : DEFAULT_EXE;
  if (!fs.existsSync(exe)) {
    throw new Error(
      `cline-app.exe not found at:\n  ${exe}\n` +
        'Pass the path explicitly:\n  node bin/cline-desktop-rtl.js patch "C:\\Path\\To\\cline-app.exe"'
    );
  }
  return exe;
}

function stopCline() {
  try {
    const { execSync } = require('child_process');
    const out = execSync('tasklist /FI "IMAGENAME eq cline-app.exe" /NH', { stdio: 'pipe' }).toString();
    if (/cline-app\.exe/i.test(out)) {
      console.log('[cline-fa-rtl] Closing running cline-app.exe ...');
      execSync('taskkill /IM cline-app.exe /F', { stdio: 'pipe' });
    }
  } catch (_) { /* ignore */ }
}

const cmd = (process.argv[2] || 'patch').toLowerCase();
const exeArg = process.argv[3];

try {
  if (cmd === 'info') {
    const exe = resolveExe(exeArg);
    const pe = parsePE(exe);
    const assets = discoverAssets(pe.buf, pe.getSection('.rdata'));
    const css = getMainCss(assets);
    console.log(`Embedded assets: ${assets.length}`);
    console.log(`Main CSS: ${css.path} (${(css.dataLen / 1024).toFixed(0)} KB raw)`);
    const fonts = assets.filter((a) => a.path.endsWith('.woff2'));
    console.log(`Fonts: ${fonts.length} woff2`);
  } else if (cmd === 'dry-run') {
    patch(resolveExe(exeArg), { dryRun: true });
  } else if (cmd === 'patch' || cmd === 'install' || cmd === 'apply') {
    const exe = resolveExe(exeArg);
    stopCline();
    patch(exe);
    console.log('\nRestart Cline Desktop to see Vazirmatn + RTL.');
  } else if (cmd === 'unpatch' || cmd === 'remove' || cmd === 'uninstall') {
    const exe = resolveExe(exeArg);
    stopCline();
    unpatch(exe);
    console.log('\nRestart Cline Desktop.');
  } else {
    console.log('Usage: node bin/cline-desktop-rtl.js [patch|unpatch|info|dry-run] [path-to-cline-app.exe]');
  }
} catch (err) {
  console.error(`\n[cline-fa-rtl] ERROR: ${err.message}`);
  process.exitCode = 1;
}
