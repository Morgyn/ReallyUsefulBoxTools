#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { execSync } = require('child_process');

function parseDim(s) {
  if (!s) return null;
  s = s.trim();
  if (s === '-' || s === '') return null;
  const parts = s.split(/[x×]/i).map(p => p.replace(/[^0-9]/g, '').trim());
  if (parts.length !== 3) return null;
  return {
    width: parts[0] === '' ? null : parseInt(parts[0], 10),
    height: parts[1] === '' ? null : parseInt(parts[1], 10),
    depth: parts[2] === '' ? null : parseInt(parts[2], 10)
  };
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const configPath = path.join(repoRoot, 'config.json');
  if (!fs.existsSync(configPath)) throw new Error('config.json not found at ' + configPath);
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const url = cfg.SIZES_URL;
  if (!url) throw new Error('SIZES_URL missing from config.json');

  console.log('Fetching', url);
  const res = await axios.get(url, { timeout: 30000, headers: { 'User-Agent': 'github-action-parser/1.0' } });
  const $ = cheerio.load(res.data);

  const table = $('table.mce-item-table, table.bluetable.mce-item-table').first();
  if (!table || table.length === 0) throw new Error('Could not find table with class mce-item-table');

  const items = [];
  table.find('tr').each((i, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 4) return; // skip headers and malformed rows
    const name = $(tds[0]).text().trim().replace(/\s+/g, ' ');
    const extRaw = $(tds[1]).text().trim();
    const intRaw = $(tds[2]).text().trim();
    const weightRaw = $(tds[3]).text().trim().replace(/[^0-9-]/g, '');
    const weight = weightRaw === '' ? null : parseInt(weightRaw, 10);

    const external = parseDim(extRaw);
    const internal = parseDim(intRaw);

    items.push({ name, external, internal, weight });
  });

  const outDir = path.join(repoRoot, 'pages');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'sizes.json');
  fs.writeFileSync(outPath, JSON.stringify(items, null, 2), 'utf8');
  console.log('Wrote', outPath);

  // Run validation test and only commit if it passes
  try {
    console.log('Running validation test');
    execSync('node scripts/validate_sizes.js', { cwd: repoRoot, stdio: 'inherit' });
  } catch (err) {
    console.error('Validation failed — not committing.');
    process.exit(2);
  }

  try {
    execSync('git config user.email "action@github.com"', { cwd: repoRoot });
    execSync('git config user.name "github-actions[bot]"', { cwd: repoRoot });
    execSync('git add pages/sizes.json', { cwd: repoRoot });
    try {
      execSync('git commit -m "chore: update sizes.json (generated)" --no-verify', { cwd: repoRoot, stdio: 'inherit' });
    } catch (err) {
      console.log('No changes to commit or commit failed:', err.message);
    }
    execSync('git push', { cwd: repoRoot, stdio: 'inherit' });
    console.log('Pushed changes');
  } catch (err) {
    console.error('Git commit/push failed:', err.message);
    // Not failing the whole script because sizes.json was produced
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
