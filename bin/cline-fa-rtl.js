#!/usr/bin/env node
'use strict';

const command = (process.argv[2] || 'patch').toLowerCase();

function printHelp() {
  console.log(`
cline-fa-rtl - Force Cline (VS Code extension) to show Persian text
               with the Vazirmatn font and RTL direction.

Usage:
  npx cline-fa-rtl            Apply the patch (default)
  npx cline-fa-rtl patch      Apply the patch
  npx cline-fa-rtl unpatch    Remove the patch and restore original files
  npx cline-fa-rtl help       Show this help

Environment variables:
  CLINE_EXTENSION_DIR   Absolute path to the Cline extension folder
                        (overrides auto-detection of .vscode/.cursor/.windsurf)

Notes:
  - Run "npm install" in this project once before the first patch.
  - After patching, reload VS Code (Ctrl+Shift+P -> Developer: Reload Window).
  - Re-run the patch after every Cline update (updates overwrite the files).
`);
}

try {
  if (command === 'patch' || command === 'install' || command === 'apply') {
    require('../src/patch').run();
  } else if (command === 'unpatch' || command === 'uninstall' || command === 'remove') {
    require('../src/unpatch').run();
  } else if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
  } else {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exitCode = 1;
  }
} catch (err) {
  console.error(`\n[cline-fa-rtl] ERROR: ${err.message}`);
  process.exitCode = 1;
}
