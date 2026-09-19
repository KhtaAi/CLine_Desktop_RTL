'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const EXT_ID_PATTERN = /^saoudrizwan\.claude-dev-/i;
const HOSTS = ['.vscode', '.cursor', '.windsurf'];

const MARKER_BEGIN = '/* === CLINE-FA-RTL BEGIN === */';
const MARKER_END = '/* === CLINE-FA-RTL END === */';
const BACKUP_SUFFIX = '.backup-before-fa-rtl';

const FONT_FILES = [
  'vazirmatn-arabic-400-normal.woff2',
  'vazirmatn-arabic-700-normal.woff2',
];

const PROJECT_ROOT = path.resolve(__dirname, '..');
const FONT_SOURCE_DIR = path.join(PROJECT_ROOT, 'node_modules', '@fontsource', 'vazirmatn', 'files');
const SNIPPET_CSS_PATH = path.join(PROJECT_ROOT, 'assets', 'vazirmatn.css');

/**
 * Locate every installed Cline extension folder on this machine.
 * A custom folder can be forced with the CLINE_EXTENSION_DIR env var.
 * @returns {string[]} absolute paths of extension directories
 */
function findExtensionDirs() {
  const found = new Set();
  const searched = [];

  for (const host of HOSTS) {
    const extensionsDir = path.join(os.homedir(), host, 'extensions');
    searched.push(extensionsDir);
    if (!fs.existsSync(extensionsDir)) continue;
    for (const entry of fs.readdirSync(extensionsDir, { withFileTypes: true })) {
      if (entry.isDirectory() && EXT_ID_PATTERN.test(entry.name)) {
        found.add(path.join(extensionsDir, entry.name));
      }
    }
  }

  if (process.env.CLINE_EXTENSION_DIR) {
    const custom = path.resolve(process.env.CLINE_EXTENSION_DIR);
    searched.push(custom);
    if (fs.existsSync(custom)) {
      found.add(custom);
    } else {
      console.warn(`[cline-fa-rtl] WARNING: CLINE_EXTENSION_DIR does not exist: ${custom}`);
    }
  }

  if (found.size === 0) {
    throw new Error(
      'Cline extension was not found on this system.\n' +
        'Searched locations:\n  - ' +
        searched.join('\n  - ') +
        '\nMake sure the Cline extension is installed in VS Code/Cursor, ' +
        'or set the CLINE_EXTENSION_DIR environment variable to the extension folder.'
    );
  }
  return [...found];
}

/**
 * Find the webview build folders (next + legacy variants) inside one extension dir.
 * @returns {Array<{buildDir:string, cssPath:string, htmlPath:string}>}
 */
function findWebviewBuilds(extensionDir) {
  const variants = ['next', 'legacy'];
  const builds = [];
  for (const variant of variants) {
    const buildDir = path.join(extensionDir, variant, 'webview-ui', 'build');
    const cssPath = path.join(buildDir, 'assets', 'index.css');
    const htmlPath = path.join(buildDir, 'index.html');
    if (fs.existsSync(cssPath) && fs.existsSync(htmlPath)) {
      builds.push({ buildDir, cssPath, htmlPath });
    }
  }
  // Fallback: some builds ship webview-ui directly under the extension root
  const rootBuild = path.join(extensionDir, 'webview-ui', 'build');
  const rootCss = path.join(rootBuild, 'assets', 'index.css');
  if (builds.length === 0 && fs.existsSync(rootCss)) {
    builds.push({ buildDir: rootBuild, cssPath: rootCss, htmlPath: path.join(rootBuild, 'index.html') });
  }
  return builds;
}

/** Build the CSS block (with markers) that gets injected into index.css. */
function buildInjectedCss() {
  const body = fs.readFileSync(SNIPPET_CSS_PATH, 'utf8');
  return '\n' + MARKER_BEGIN + '\n' + body.trim() + '\n' + MARKER_END + '\n';
}

/** Remove a previously injected block from css text (idempotent). */
function stripInjectedCss(css) {
  const begin = css.indexOf(MARKER_BEGIN);
  const end = css.indexOf(MARKER_END);
  if (begin === -1 || end === -1 || end < begin) return css;
  return css.slice(0, begin) + css.slice(end + MARKER_END.length);
}

/** Absolute path of every font file that must exist inside the webview assets dir. */
function fontTargets(buildDir) {
  return FONT_FILES.map((f) => path.join(buildDir, 'assets', f));
}

function ensureFontsAvailable() {
  for (const file of FONT_FILES) {
    const src = path.join(FONT_SOURCE_DIR, file);
    if (!fs.existsSync(src)) {
      throw new Error(
        `Font file not found: ${src}\n` +
          'Run "npm install" inside the cline-fa-rtl project folder first.'
      );
    }
  }
}

module.exports = {
  MARKER_BEGIN,
  MARKER_END,
  BACKUP_SUFFIX,
  FONT_FILES,
  FONT_SOURCE_DIR,
  findExtensionDirs,
  findWebviewBuilds,
  buildInjectedCss,
  stripInjectedCss,
  fontTargets,
  ensureFontsAvailable,
};
