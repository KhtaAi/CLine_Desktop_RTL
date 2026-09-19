'use strict';

const fs = require('fs');
const path = require('path');
const brotli = require('brotli-wasm');
const { parsePE } = require('./pe');
const {
  BACKUP_SUFFIX,
  FONT_DEFS,
  discoverAssets,
  findRecords,
  findZeroSpace,
  findZeroRegions,
  getMainCss,
  readAssetText,
} = require('./binary-patch');

const INJECT_CSS_PATH = path.join(__dirname, '..', 'assets', 'vazirmatn-desktop.css');

function patch(exePath, { dryRun = false } = {}) {
  console.log(`[cline-fa-rtl] Target: ${exePath}`);
  const pe = parsePE(exePath);
  const rdata = pe.getSection('.rdata');
  if (!rdata) throw new Error('.rdata section not found');

  console.log('[cline-fa-rtl] Discovering embedded assets (~30s)...');
  const assets = discoverAssets(pe.buf, rdata);
  console.log(`[cline-fa-rtl] Found ${assets.length} embedded assets`);

  const css = getMainCss(assets);
  console.log(`[cline-fa-rtl] Main CSS: ${css.path} (${(css.dataLen / 1024).toFixed(0)} KB raw, ${(css.compressedLen / 1024).toFixed(0)} KB brotli)`);

  // already patched?
  const currentCss = readAssetText(pe.buf, css);
  if (currentCss.includes('Vazirmatn') && currentCss.includes('CLINE-FA-RTL')) {
    console.log('[cline-fa-rtl] Already patched. Nothing to do.');
    return { patched: false, already: true };
  }

  // build new CSS
  const injectCss = fs.readFileSync(INJECT_CSS_PATH, 'utf8').trim();
  const newCss = injectCss + '\n' + currentCss;
  let newCompressed = Buffer.from(brotli.compress(Buffer.from(newCss, 'utf8'), { quality: 11 }));
  if (newCompressed.length > css.compressedLen) {
    newCompressed = Buffer.from(brotli.compress(Buffer.from(newCss, 'utf8'), { quality: 9 }));
  }
  const delta = newCompressed.length - css.compressedLen;
  console.log(`[cline-fa-rtl] New CSS brotli: ${newCompressed.length} bytes (delta ${delta >= 0 ? '+' : ''}${delta})`);

  if (dryRun) {
    return { patched: false, dryRun: true, css: css.path, delta, assets: assets.length };
  }

  // backup
  const backupPath = exePath + BACKUP_SUFFIX;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(exePath, backupPath);
    console.log(`[cline-fa-rtl] Backup: ${backupPath}`);
  }

  const out = Buffer.from(pe.buf);

  // --- patch CSS ---
  if (newCompressed.length <= css.compressedLen) {
    newCompressed.copy(out, css.dataOff);
    out.fill(0, css.dataOff + newCompressed.length, css.dataOff + css.compressedLen);
    console.log('[cline-fa-rtl] CSS patched in place.');
  } else {
    const dest = findZeroSpace(out, rdata, newCompressed.length + 32);
    if (dest === -1) throw new Error('No room in .rdata to relocate the CSS blob');
    newCompressed.copy(out, dest);
    const targets = new Set([css.dataOff]);
    const recs = findRecords(pe, rdata, targets).filter((r) => r.len === css.compressedLen);
    if (!recs.length) throw new Error('PHF record for the CSS asset not found');
    const rec = recs[0];
    const newRva = BigInt(pe.imageBase + rdata.virtualAddress + (dest - rdata.pointerToRawData));
    out.writeBigUInt64LE(newRva, rec.recOff);
    out.writeUInt32LE(newCompressed.length, rec.recOff + 8);
    console.log(`[cline-fa-rtl] CSS relocated to +${dest}, record @${rec.recOff} updated.`);
  }

  // --- patch fonts ---
  // NOTE: even woff2 assets are stored brotli-compressed in this binary.
  const donors = assets.filter((a) => a.compressed && a.path.endsWith('.woff2'));
  donors.sort((a, b) => b.compressedLen - a.compressedLen);
  if (donors.length < FONT_DEFS.length) {
    throw new Error(`Only ${donors.length} donor fonts available for ${FONT_DEFS.length} Vazirmatn fonts`);
  }

  // fonts are embedded brotli-compressed, so compress ours the same way.
  // strategy: overwrite each donor font IN PLACE (data + path + length record)
  // so the PHF key (path string) and the content both become Vazirmatn.
  const fontPayloads = FONT_DEFS.map((f) => {
    const raw = fs.readFileSync(f.file);
    let comp = Buffer.from(brotli.compress(raw, { quality: 11 }));
    if (comp.length >= raw.length) comp = Buffer.from(brotli.compress(raw, { quality: 5 }));
    return { assetPath: f.assetPath, raw, data: comp };
  });

  // records for all donor fonts
  const donorTargets = new Set(donors.map((d) => d.dataOff));
  const allRecords = findRecords(pe, rdata, donorTargets);

  for (let i = 0; i < fontPayloads.length; i++) {
    const font = fontPayloads[i];
    const donor = donors[i];

    // sanity: our path must fit where the donor's path was
    if (font.assetPath.length > donor.pathLen) {
      throw new Error(`Vazirmatn path (${font.assetPath.length}) longer than donor path (${donor.pathLen}) for ${donor.path}`);
    }
    // sanity: our compressed font must fit where the donor's data was
    if (font.data.length > donor.compressedLen) {
      throw new Error(
        `Vazirmatn ${path.basename(font.assetPath)} is ${font.data.length} bytes compressed, donor ${path.basename(donor.path)} only holds ${donor.compressedLen}`
      );
    }

    // 1) overwrite the donor path cstring with ours (NUL-padded)
    out.fill(0, donor.pathOff, donor.pathOff + donor.pathLen + 1);
    Buffer.from(font.assetPath, 'latin1').copy(out, donor.pathOff);

    // 2) overwrite the donor font data with ours (zero-padded tail)
    font.data.copy(out, donor.dataOff);
    out.fill(0, donor.dataOff + font.data.length, donor.dataOff + donor.compressedLen);

    // 3) update the length in the donor's PHF record (pointer stays the same)
    const rec = allRecords.find((r) => r.targetOff === donor.dataOff && r.len === donor.compressedLen);
    if (!rec) throw new Error(`PHF record for donor ${donor.path} not found`);
    out.writeUInt32LE(font.data.length, rec.recOff + 8);
    console.log(
      `[cline-fa-rtl] Font ${path.basename(font.assetPath)} -> in place of ${path.basename(donor.path)} ` +
        `(${font.data.length} <= ${donor.compressedLen} bytes, record @${rec.recOff})`
    );
  }

  fs.writeFileSync(exePath, out);
  console.log(`\n[cline-fa-rtl] Patched ${exePath}`);
  return { patched: true, backupPath, delta };
}

function unpatch(exePath) {
  const backupPath = exePath + BACKUP_SUFFIX;
  if (!fs.existsSync(backupPath)) {
    console.log('[cline-fa-rtl] No backup found; nothing to restore.');
    return { restored: false };
  }
  fs.copyFileSync(backupPath, exePath);
  fs.unlinkSync(backupPath);
  console.log(`[cline-fa-rtl] Restored ${exePath} from backup.`);
  return { restored: true };
}

module.exports = { patch, unpatch };
