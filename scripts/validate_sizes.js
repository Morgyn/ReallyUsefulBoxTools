#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function isInt(n) { return Number.isInteger(n); }

const repoRoot = path.resolve(__dirname, '..');
const sizesPath = path.join(repoRoot, 'pages', 'sizes.json');
if (!fs.existsSync(sizesPath)) {
  console.error('sizes.json not found at', sizesPath);
  process.exit(2);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(sizesPath, 'utf8'));
} catch (err) {
  console.error('Failed to parse sizes.json:', err.message);
  process.exit(2);
}

if (!Array.isArray(data) || data.length === 0) {
  console.error('sizes.json should be a non-empty array');
  process.exit(2);
}

for (let i = 0; i < data.length; i++) {
  const it = data[i];
  if (!it || typeof it.name !== 'string' || it.name.trim() === '') {
    console.error('Item', i, 'has invalid name');
    process.exit(2);
  }
  const checkDim = (d) => {
    if (d === null) return true;
    if (typeof d !== 'object') return false;
    return ('width' in d) && ('height' in d) && ('depth' in d) &&
      (d.width === null || isInt(d.width)) && (d.height === null || isInt(d.height)) && (d.depth === null || isInt(d.depth));
  };
  if (!checkDim(it.external) || !checkDim(it.internal)) {
    console.error('Item', i, 'has invalid dimensions', it.name);
    process.exit(2);
  }
  if (it.weight !== null && typeof it.weight !== 'number') {
    console.error('Item', i, 'has invalid weight', it.name);
    process.exit(2);
  }
}

console.log('Validation passed —', data.length, 'items');
process.exit(0);
