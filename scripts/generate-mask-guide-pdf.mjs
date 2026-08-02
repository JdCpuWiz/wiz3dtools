#!/usr/bin/env node
// Regenerate the printable mask guide served by the admin:
//   docs/ADDING_PRODUCTS.md  →  packages/frontend/public/docs/mask-guide.pdf
//
// Run from the repo root after editing the markdown:
//   node scripts/generate-mask-guide-pdf.mjs
//
// Needs a headless Chromium for the PDF step. Uses playwright-core from the
// globally installed @playwright/cli (present on the dev box); pass an
// explicit executable via CHROMIUM_PATH if that layout ever changes.

import { marked } from 'marked';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'docs/ADDING_PRODUCTS.md');
const OUT = path.join(root, 'packages/frontend/public/docs/mask-guide.pdf');

const md = await fs.readFile(SRC, 'utf8');
const body = marked.parse(md);

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { margin: 18mm 16mm; }
  body { font-family: 'Poppins', -apple-system, 'Segoe UI', sans-serif;
         color: #1a1a1a; font-size: 10.5pt; line-height: 1.55; }
  h1 { font-size: 20pt; border-bottom: 3px solid #ff9900; padding-bottom: 6px; }
  h2 { font-size: 14pt; color: #b36b00; margin-top: 1.6em; }
  h1, h2, h3 { page-break-after: avoid; }
  code { background: #f2f2f2; padding: 1px 4px; border-radius: 3px;
         font-family: 'JetBrains Mono', Menlo, monospace; font-size: 9pt; }
  pre code { display: block; padding: 8px; }
  table { border-collapse: collapse; width: 100%; font-size: 9.5pt; page-break-inside: avoid; }
  th, td { border: 1px solid #cccccc; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #ff9900; color: #1a1a1a; }
  strong { color: #000000; }
  li { margin-bottom: 0.25em; }
  blockquote { border-left: 3px solid #ff9900; margin-left: 0; padding-left: 12px; color: #444444; }
  .footer { margin-top: 2em; font-size: 8pt; color: #888888; }
</style></head><body>${body}
<div class="footer">Generated from wiz3dtools/docs/ADDING_PRODUCTS.md — regenerate with scripts/generate-mask-guide-pdf.mjs after editing.</div>
</body></html>`;

const require = createRequire(import.meta.url);
const corePath = process.env.CHROMIUM_PATH
  ? null
  : '/usr/local/lib/node_modules/@playwright/cli/node_modules/playwright-core';
const { chromium } = require(corePath ?? 'playwright-core');

await fs.mkdir(path.dirname(OUT), { recursive: true });
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle' });
await page.pdf({ path: OUT, format: 'Letter', printBackground: true });
await browser.close();

const { size } = await fs.stat(OUT);
console.log(`wrote ${path.relative(root, OUT)} (${(size / 1024).toFixed(0)} KB)`);
