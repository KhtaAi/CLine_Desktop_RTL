'use strict';

const fs = require('fs');
const path = require('path');
const brotli = require('brotli-wasm');
const { parsePE } = require('./pe');

const BACKUP_SUFFIX = '.backup-before-fa-rtl';
const INJECT_CSS_PATH = path.join(__dirname, '..', 'assets', 'vazirmatn-desktop.css');

const FONT_DEFS = [
  {
    assetPath: '/_next/static/media/vazirmatn-arabic-400-normal.woff2',
    file: path.join(__dirname, '..', 'node_modules', '@fontsource', 'vazirmatn', 'files', 'vazirmatn-arabic-400-normal.woff2'),
  },
  {
    assetPath: '/_next/static/media/vazirmatn-arabic-700-normal.woff2',
    file: path.join(__dirname, '..', 'node_modules', '@fontsource', 'vazirmatn', 'files', 'vazirmatn-arabic-700-normal.woff2'),
  },
];

const PATH_RE = /\/(?:_next\/static\/[\w\-\.\/]+|index\.html|404\.html|_not-found\.html)/g;
const RAW_MAGICS = ['wOF2', 'wOFF', 'OTTO', 'PNG'];
const RAW_MAGIC_BUFS = RAW_MAGICS.map((m) => Buffer.from(m, 'latin1'));
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function isPrintable(b) {
  return b >= 0x20 && b < 0x7f;
}

/** Locate an embedded asset entry (path + content) starting at pathOff. */
function resolveEntry(buf, rdata, pathOff, pathLen) {
  const rdataEnd = rdata.pointerToRawData + rdata.sizeOfRawData;
  for (let gap = 0; gap <= 6; gap++) {
    const start = pathOff + pathLen + gap;
    if (start >= rdataEnd) break;
    // try brotli
    try {
      const out = brotli.decompress(buf.slice(start, rdataEnd));
      if (out && out.length > 20) {
        const compressedLen = findCompressedLen(buf, start, out.length, rdataEnd);
        return { dataOff: start, dataLen: out.length, compressed: true, compressedLen };
      }
    } catch (_) { /* not brotli */ }
    // try raw
    const head4 = buf.slice(start, start + 4).toString('latin1');
    if (RAW_MAGICS.includes(head4) || buf.slice(start, start + 4).equals(PNG_MAGIC)) {
      const dataLen = rawAssetLength(buf, start, rdataEnd);
      return { dataOff: start, dataLen, compressed: false, compressedLen: dataLen };
    }
  }
  return null;
}

/** Bisect the smallest input prefix that decompresses to expectedLen bytes. */
function findCompressedLen(buf, dataOff, expectedLen, rdataEnd) {
  let lo = 16;
  let hi = Math.min(rdataEnd - dataOff, 8 * 1024 * 1024);
  let ans = hi;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    let ok = false;
    try {
      const d = brotli.decompress(buf.slice(dataOff, dataOff + mid));
      ok = d && d.length === expectedLen;
    } catch (_) { ok = false; }
    if (ok) { ans = mid; hi = mid; } else lo = mid + 1;
  }
  return ans;
}

/** Estimate raw asset length by scanning to the next asset path or 64+ zero run. */
function rawAssetLength(buf, start, rdataEnd) {
  const latin = buf.toString('latin1');
  let end = start;
  const limit = Math.min(start + 2 * 1024 * 1024, rdataEnd);
  let zeros = 0;
  while (end < limit) {
    const b = buf[end];
    if (b === 0x2f && latin.slice(end, end + 7) === '/_next/') break;
    if (b === 0) { zeros++; if (zeros >= 64) { end -= 63; break; } } else zeros = 0;
    end++;
  }
  return end - start;
}

/** Discover every embedded asset in .rdata. */
function discoverAssets(exeBuf, rdata) {
  const latin = exeBuf.toString('latin1');
  const rdataStart = rdata.pointerToRawData;
  const rdataEnd = rdataStart + rdata.sizeOfRawData;
  const assets = [];
  const seen = new Set();
  let m;
  PATH_RE.lastIndex = 0;
  while ((m = PATH_RE.exec(latin))) {
    const rel = m[0];
    if (seen.has(rel)) continue;
    const pathOff = m.index;
    if (pathOff < rdataStart || pathOff >= rdataEnd) continue;
    // skip when the match is part of a longer word (noise)
    if (pathOff > 0 && isPrintable(exeBuf[pathOff - 1]) && exeBuf[pathOff - 1] !== 0x2f) continue;
    const entry = resolveEntry(exeBuf, rdata, pathOff, rel.length);
    if (!entry) continue;
    seen.add(rel);
    assets.push({ path: rel, pathOff, pathLen: rel.length, ...entry });
  }
  return assets;
}

/** Scan for 12-byte PHF-like records {u32, u64 ptr-to-rdata, u32 len}. */
function findRecords(pe, rdata, targets) {
  const buf = pe.buf;
  const rdataStart = rdata.pointerToRawData;
  const rdataEnd = rdataStart + rdata.sizeOfRawData;
  const out = [];
  for (let fo = 0; fo < buf.length - 12; fo += 4) {
    const va = Number(buf.readBigUInt64LE(fo));
    if (va < pe.imageBase + rdata.virtualAddress) continue;
    const targetOff = va - pe.imageBase - rdata.virtualAddress + rdataStart;
    if (targetOff < rdataStart || targetOff >= rdataEnd) continue;
    if (!targets.has(targetOff)) continue;
    const len = buf.readUInt32LE(fo + 8);
    if (len > 0 && len < 16 * 1024 * 1024) out.push({ recOff: fo, targetOff, len });
  }
  return out;
}

/** Find a run of `size` 0x00 bytes in .rdata (searching from the end). */
function findZeroSpace(buf, rdata, size) {
  const start = rdata.pointerToRawData;
  const end = start + rdata.sizeOfRawData;
  let run = 0;
  for (let fo = end - 1; fo >= start; fo--) {
    if (buf[fo] === 0) { if (++run >= size) return fo; } else run = 0;
  }
  return -1;
}

/** Collect every zero-run >= minLen inside .rdata, sorted largest-first. */
function findZeroRegions(buf, rdata, minLen) {
  const start = rdata.pointerToRawData;
  const end = start + rdata.sizeOfRawData;
  const regions = [];
  let runStart = -1;
  for (let fo = start; fo <= end; fo++) {
    const isZero = fo < end && buf[fo] === 0;
    if (isZero && runStart === -1) runStart = fo;
    if (!isZero && runStart !== -1) {
      const len = fo - runStart;
      if (len >= minLen) regions.push({ off: runStart, len });
      runStart = -1;
    }
  }
  regions.sort((a, b) => b.len - a.len);
  return regions;
}

/** Format bytes */
function kb(n) { return (n / 1024).toFixed(1) + ' KB'; }

function getMainCss(assets) {
  const css = assets.filter((a) => a.compressed && a.path.endsWith('.css'));
  css.sort((a, b) => b.dataLen - a.dataLen);
  if (!css.length) throw new Error('No embedded CSS asset found');
  return css[0];
}

function readAssetText(exeBuf, asset) {
  return Buffer.from(brotli.decompress(exeBuf.slice(asset.dataOff, asset.dataOff + asset.compressedLen))).toString('utf8');
}

module.exports = {
  BACKUP_SUFFIX,
  FONT_DEFS,
  discoverAssets,
  findRecords,
  findZeroSpace,
  findZeroRegions,
  getMainCss,
  readAssetText,
  isPrintable,
};
