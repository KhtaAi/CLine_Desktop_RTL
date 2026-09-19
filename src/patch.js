'use strict';

const fs = require('fs');
const path = require('path');
const {
  BACKUP_SUFFIX,
  FONT_FILES,
  FONT_SOURCE_DIR,
  findExtensionDirs,
  findWebviewBuilds,
  buildInjectedCss,
  stripInjectedCss,
  ensureFontsAvailable,
} = require('./common');

function patchOne(cssPath) {
  const backupPath = cssPath + BACKUP_SUFFIX;

  // 1) One-time backup of the original file
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(cssPath, backupPath);
    console.log(`  backup   -> ${backupPath}`);
  }

  // 2) Remove any older injected block (makes re-running safe / updatable)
  let css = fs.readFileSync(cssPath, 'utf8');
  css = stripInjectedCss(css);

  // 3) Append the Vazirmatn + RTL block
  css = css.replace(/\s*$/, '') + buildInjectedCss();
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log(`  patched  -> ${cssPath}`);
}

function copyFonts(buildDir) {
  const assetsDir = path.join(buildDir, 'assets');
  for (const file of FONT_FILES) {
    const src = path.join(FONT_SOURCE_DIR, file);
    const dest = path.join(assetsDir, file);
    fs.copyFileSync(src, dest);
    console.log(`  font     -> ${dest}`);
  }
}

function run() {
  console.log('[cline-fa-rtl] Applying Vazirmatn font + RTL patch to Cline...');
  ensureFontsAvailable();

  const extensionDirs = findExtensionDirs();
  let patchedCount = 0;

  for (const extensionDir of extensionDirs) {
    console.log(`\nExtension: ${extensionDir}`);
    const builds = findWebviewBuilds(extensionDir);
    if (builds.length === 0) {
      console.warn('  WARNING: no webview-ui build found in this extension folder, skipped.');
      continue;
    }
    for (const { buildDir, cssPath } of builds) {
      patchOne(cssPath);
      copyFonts(buildDir);
      patchedCount++;
    }
  }

  if (patchedCount === 0) {
    throw new Error('Nothing was patched. Is the Cline extension installed correctly?');
  }

  console.log(
    `\n[cline-fa-rtl] Done. ${patchedCount} webview build(s) patched.` +
      '\nReload VS Code (Ctrl+Shift+P -> "Developer: Reload Window") or reopen Cline to see the changes.'
  );
}

module.exports = { run };
