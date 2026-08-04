#!/usr/bin/env node
/**
 * Facebook posting smoke test (Change #442).
 *
 * Exercises the REAL Graph client (packages/backend/dist/services/facebook.service.js)
 * against the REAL Page without anyone seeing a post: the photo is uploaded
 * UNPUBLISHED (media library only), then deleted. Same round-trip the C438
 * investigation used to validate the tokens.
 *
 * Use it whenever you suspect the Page token has died — the symptom in the
 * admin UI is a red "Facebook post failed" banner, and this tells you in one
 * command whether it's the token or the image.
 *
 *   cd /home/shad/wiz3dtools
 *   npm run build -w @wizqueue/backend       # dist must exist
 *   set -a; . ./.env; set +a
 *   node scripts/facebook-smoke.mjs [image-url]
 *
 * Default image is a public product photo from the storefront. Pass another
 * URL to check whether a specific image is reachable/acceptable to Facebook.
 */

const GRAPH = 'https://graph.facebook.com/v23.0';

const imageUrl = process.argv[2] || 'https://tools.wiz3dprints.com/uploads/store/product-1781470906581-353464216-processed.webp';
const pageId = process.env.FACEBOOK_PAGE_ID;
const token = process.env.FACEBOOK_PAGE_TOKEN;

if (!pageId || !token) {
  console.error('FACEBOOK_PAGE_ID / FACEBOOK_PAGE_TOKEN not set. Source the .env first:');
  console.error('  set -a; . ./.env; set +a');
  process.exit(2);
}

const { postToPage, isFacebookConfigured } = await import('../packages/backend/dist/services/facebook.service.js');

function fail(step, err) {
  console.error(`✗ ${step}: ${err?.message ?? err}`);
  process.exit(1);
}

console.log(`configured: ${isFacebookConfigured()}`);

// 1. Token identity — proves the token is alive and belongs to the Page.
let page;
try {
  const res = await fetch(`${GRAPH}/${pageId}?fields=id,name&access_token=${encodeURIComponent(token)}`);
  page = await res.json();
  if (!res.ok) throw new Error(page?.error?.message || `HTTP ${res.status}`);
} catch (err) {
  fail('token check', err);
}
console.log(`✓ token valid — Page: ${page.name} (${page.id})`);

// 2. Unpublished photo post through the real client.
let result;
try {
  result = await postToPage({
    message: `Smoke test ${new Date().toISOString()} — unpublished, deleted immediately.`,
    imageUrl,
    unpublished: true,
  });
} catch (err) {
  fail(`unpublished photo post (${imageUrl})`, err);
}
console.log(`✓ photo accepted — id ${result.postId} (withPhoto=${result.withPhoto})`);

// 3. Clean up so nothing lingers in the Page's media library.
try {
  const res = await fetch(`${GRAPH}/${result.postId}?access_token=${encodeURIComponent(token)}`, { method: 'DELETE' });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);
  console.log('✓ test photo deleted');
} catch (err) {
  console.warn(`⚠ could not delete the test photo (${result.postId}) — remove it by hand from the Page's media library: ${err.message}`);
}

console.log('\nAll good — the token posts and the image is reachable.');
