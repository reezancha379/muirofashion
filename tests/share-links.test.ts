import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLookbookShareUrl, createProductShareUrl } from '../src/lib/shareLinks';

const origin = 'https://muirofashion.netlify.app';
const lookUrl = new URL(createLookbookShareUrl('look/with spaces', origin));
assert.equal(lookUrl.origin, origin);
assert.equal(lookUrl.pathname, '/');
assert.equal(lookUrl.searchParams.get('look'), 'look/with spaces');

const productUrl = new URL(createProductShareUrl('product-42', origin));
assert.equal(productUrl.origin, origin);
assert.equal(productUrl.pathname, '/');
assert.equal(productUrl.searchParams.get('view'), 'collections');
assert.equal(productUrl.searchParams.get('product'), 'product-42');

const root = path.dirname(fileURLToPath(import.meta.url));
const shareButton = fs.readFileSync(path.join(root, '../src/components/common/ShareButton.tsx'), 'utf8');
assert.match(shareButton, /Could not copy automatically\. Select and copy this link:/);
assert.match(shareButton, /shareUrl:\s*url/);
assert.match(shareButton, /notice\.shareUrl[\s\S]*?select-all[\s\S]*?\{notice\.shareUrl\}/);
assert.doesNotMatch(shareButton, /copy it from your address bar/i);

console.log('PASS static-host-safe lookbook and product share URLs');
