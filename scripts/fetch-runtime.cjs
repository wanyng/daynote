'use strict';
// Recovery downloader for networks where the standard Electron downloader stalls.
// It resumes an existing partial download and verifies the checksum shipped by Electron.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
async function main() {
  const root = path.resolve(__dirname, '..');
  const { version } = require('../node_modules/electron/package.json');
  const filename = `electron-v${version}-${process.platform}-${process.arch}.zip`;
  const directory = path.join(root, '.cache/downloads');
  fs.mkdirSync(directory, { recursive: true });
  const partial = path.join(directory, filename + '.part');
  const output = path.join(directory, filename);
  let size = fs.existsSync(partial) ? fs.statSync(partial).size : 0;
  const response = await fetch(`https://github.com/electron/electron/releases/download/v${version}/${filename}`, { headers: size ? { Range: `bytes=${size}-` } : {}, signal: AbortSignal.timeout(900000) });
  if (!response.ok) throw new Error('Download HTTP ' + response.status);
  const resume = size > 0 && response.status === 206;
  if (!resume) size = 0;
  const total = size + Number(response.headers.get('content-length'));
  console.log(`Downloading official Electron: ${Math.round(size / 1048576)} / ${Math.round(total / 1048576)} MiB`);
  let received = size, report = size;
  const source = Readable.fromWeb(response.body);
  source.on('data', chunk => {
    received += chunk.length;
    if (received - report >= 16 * 1048576) { report = received; console.log(`${Math.round(received / 1048576)} / ${Math.round(total / 1048576)} MiB`); }
  });
  await pipeline(source, fs.createWriteStream(partial, { flags: resume ? 'a' : 'w' }));
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(partial)) hash.update(chunk);
  const actual = hash.digest('hex');
  const expected = require('../node_modules/electron/checksums.json')[filename];
  if (actual !== expected) throw new Error('Official SHA256 verification failed; partial file retained for inspection');
  fs.renameSync(partial, output);
  console.log('Verified SHA256:', actual);
  console.log(output);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
