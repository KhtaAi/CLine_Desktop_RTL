'use strict';

/**
 * Minimal PE (Portable Executable) helper for 64-bit Windows binaries.
 * Maps section RVA <-> file offsets so we can locate and edit data
 * embedded in the binary's read-only data section.
 */

const fs = require('fs');

function parsePE(filePath) {
  const buf = fs.readFileSync(filePath);

  if (buf.readUInt16LE(0) !== 0x5a4d) throw new Error('Not an MZ/PE file');
  const peOffset = buf.readUInt32LE(0x3c);
  if (buf.readUInt32LE(peOffset) !== 0x00004550) throw new Error('Bad PE signature');

  const coffOffset = peOffset + 4;
  const numberOfSections = buf.readUInt16LE(coffOffset + 2);
  const sizeOfOptionalHeader = buf.readUInt16LE(coffOffset + 16);
  const optOffset = coffOffset + 20;
  const magic = buf.readUInt16LE(optOffset);
  if (magic !== 0x20b) throw new Error('Only PE32+ (x64) binaries are supported');

  const imageBase = Number(buf.readBigUInt64LE(optOffset + 24));
  const sizeOfImage = buf.readUInt32LE(optOffset + 56);

  const sectionTable = optOffset + sizeOfOptionalHeader;
  const sections = [];
  for (let i = 0; i < numberOfSections; i++) {
    const off = sectionTable + i * 40;
    const name = buf.slice(off, off + 8).toString('latin1').replace(/\0.*$/, '');
    sections.push({
      name,
      virtualSize: buf.readUInt32LE(off + 8),
      virtualAddress: buf.readUInt32LE(off + 12), // RVA
      sizeOfRawData: buf.readUInt32LE(off + 16),
      pointerToRawData: buf.readUInt32LE(off + 20), // file offset
    });
  }

  function rvaToFileOffset(rva) {
    for (const s of sections) {
      const span = Math.max(s.virtualSize, s.sizeOfRawData);
      if (rva >= s.virtualAddress && rva < s.virtualAddress + span) {
        return s.pointerToRawData + (rva - s.virtualAddress);
      }
    }
    return -1;
  }

  function vaToFileOffset(va) {
    return rvaToFileOffset(va - imageBase);
  }

  function fileOffsetToRva(fo) {
    for (const s of sections) {
      if (fo >= s.pointerToRawData && fo < s.pointerToRawData + s.sizeOfRawData) {
        return s.virtualAddress + (fo - s.pointerToRawData);
      }
    }
    return -1;
  }

  function getSection(name) {
    return sections.find((s) => s.name === name) || null;
  }

  return { buf, imageBase, sizeOfImage, sections, rvaToFileOffset, vaToFileOffset, fileOffsetToRva, getSection };
}

/**
 * Read a 64-bit code pointer stored at file offset `fo` inside .text.
 * Returns the pointed-to file offset (via RVA mapping) or -1.
 */
function readPointerAt(pe, fo) {
  const va = Number(pe.buf.readBigUInt64LE(fo));
  if (va < pe.imageBase || va >= pe.imageBase + pe.sizeOfImage) return -1;
  return pe.vaToFileOffset(va);
}

module.exports = { parsePE, readPointerAt };
