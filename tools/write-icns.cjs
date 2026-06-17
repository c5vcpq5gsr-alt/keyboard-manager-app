#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const [, , iconsetDir, outFile] = process.argv;

if (!iconsetDir || !outFile) {
  console.error('Usage: node tools/write-icns.cjs <iconset-dir> <out.icns>');
  process.exit(1);
}

const blocks = [
  ['icp4', 'icon_16x16.png'],
  ['ic11', 'icon_16x16@2x.png'],
  ['icp5', 'icon_32x32.png'],
  ['ic12', 'icon_32x32@2x.png'],
  ['ic07', 'icon_128x128.png'],
  ['ic13', 'icon_128x128@2x.png'],
  ['ic08', 'icon_256x256.png'],
  ['ic14', 'icon_256x256@2x.png'],
  ['ic09', 'icon_512x512.png'],
  ['ic10', 'icon_512x512@2x.png'],
];

const chunks = blocks.map(([type, fileName]) => {
  const png = fs.readFileSync(path.join(iconsetDir, fileName));
  if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error(`${fileName} is not a PNG file`);
  }

  const header = Buffer.alloc(8);
  header.write(type, 0, 4, 'ascii');
  header.writeUInt32BE(png.length + 8, 4);
  return Buffer.concat([header, png]);
});

const size = chunks.reduce((sum, chunk) => sum + chunk.length, 8);
const header = Buffer.alloc(8);
header.write('icns', 0, 4, 'ascii');
header.writeUInt32BE(size, 4);

fs.writeFileSync(outFile, Buffer.concat([header, ...chunks], size));
console.log(`Generated ${outFile}`);
