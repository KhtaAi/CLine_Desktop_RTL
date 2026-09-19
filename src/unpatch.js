'use strict';

const fs = require('fs');
const {
  BACKUP_SUFFIX,
  findExtensionDirs,
  findWebviewBuilds,
  stripInjectedCss,
  fontTargets,
} = require('./common');

function unpatchOne(cssPath) {
  const backupPath = cssPath + BACKUP_SUFFIX;

  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, cssPath);
    fs.unlinkSync(backupPath);
    console.log(`  restored -> ${cssPath} (from backup)`);
    return;
  }

  const css = fs.readFileSync(cssPath, 'utf8');
  const stripped = stripInjectedCss(css);
  if (stripped !== css) {
    fs.writeFileSync(cssPath, stripped, 'utf8');
    console.log(`  cleaned  -> ${cssPath} (marker block removed)`);
  } else {
    console.log(`  ok       -> ${cssPath} (no patch found)`);
  }
}

function removeFonts(buildDir) {
  for (const target of fontTargets(buildDir)) {
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
      console.log(`  removed  -> ${target}`);
    }
  }
}

function run() {
  console.log('[cline-fa-rtl] Removing Vazirmatn font + RTL patch from Cline...');

  const extensionDirs = findExtensionDirs();
  let count = 0;

  for (const extensionDir of extensionDirs) {
    console.log(`\nExtension: ${extensionDir}`);
    const builds = findWebviewBuilds(extensionDir);
    if (builds.length === 0) {
      console.warn('  WARNING: no webview-ui build found, skipped.');
      continue;
    }
    for (const { buildDir, cssPath } of builds) {
      unpatchOne(cssPath);
      removeFonts(buildDir);
      count++;
    }
  }

  console.log(
    `\n[cline-fa-rtl] Done. ${count} webview build(s) restored.` +
      '\nReload VS Code (Ctrl+Shift+P -> "Developer: Reload Window") to apply.'
  );
}

module.exports = { run };
