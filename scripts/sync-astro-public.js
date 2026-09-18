#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const publicRoot = path.join(root, 'public');
const astroManagedToolFiles = {
  'clean-html-printer': ['index.html'], 'clean-pdf-printer': ['index.html'], 'compress-pdf': ['index.html'],
  'document-flattener': ['index.html'], 'heic-to-jpg': ['index.html'], 'image-to-pdf': ['index.html'],
  'japa-counter': ['index.html', 'tap.html'], 'merge-pdf': ['index.html'], 'passport-photo': ['index.html'],
  'photo-to-scan': ['index.html'], 'qr-code-maker': ['index.html'], 'remove-photo-metadata': ['index.html'],
  'resize-image': ['index.html'], 'split-pdf': ['index.html']
};
const directories = [
  'about', 'assets', 'clean-html-printer', 'clean-pdf-printer', 'compress-pdf', 'docs',
  'document-flattener', 'heic-to-jpg', 'image-to-pdf', 'japa-counter', 'merge-pdf',
  'passport-photo', 'photo-to-scan', 'principles', 'qr-code-maker', 'remove-photo-metadata',
  'resize-image', 'sheetlocal', 'split-pdf'
];
const files = ['CNAME', 'google5f4708aeb39de005.html', 'manifest.webmanifest', 'robots.txt', 'sitemap.xml', 'sw.js', 'VERSION'];

fs.rmSync(publicRoot, { recursive: true, force: true });
fs.mkdirSync(publicRoot, { recursive: true });
for (const directory of directories) {
  const source = path.join(root, directory);
  const skippedFiles = new Set(astroManagedToolFiles[directory] || []);
  fs.cpSync(source, path.join(publicRoot, directory), {
    recursive: true,
    filter: item => !skippedFiles.has(path.relative(source, item))
  });
}
for (const file of files) fs.copyFileSync(path.join(root, file), path.join(publicRoot, file));
console.log(`Synced ${directories.length} static route directories into public/.`);
