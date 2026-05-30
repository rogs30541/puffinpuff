/* eslint-disable @typescript-eslint/no-require-imports */
const pngToIco = require('png-to-ico');
const fs = require('node:fs');
const path = require('node:path');

const pngPath = path.join(__dirname, '..', 'build', 'icon.png');
const icoPath = path.join(__dirname, '..', 'build', 'icon.ico');

pngToIco(pngPath)
  .then((buf) => {
    fs.writeFileSync(icoPath, buf);
    console.log('[icon] generated:', icoPath, `(${buf.length} bytes)`);
  })
  .catch((e) => {
    console.error('[icon] failed:', e);
    process.exit(1);
  });
