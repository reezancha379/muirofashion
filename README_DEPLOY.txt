MUIRO CONTENT SYSTEM

DEPLOY
1. Run npm ci and npm run build:static, or let Netlify run its configured build.
2. Publish only the generated site/ directory. Never upload the repository root.
3. Inspect site/index.html and run npm run verify:static before publishing.
4. Verify the new live deploy serves hashed assets and React renders.
5. Do not delete the previous Netlify site until this version is verified.

EDIT PRODUCTS
Open products.js. Add or edit one product object at a time.
Each product needs a unique id, title, price, board, category, image, description, and affiliate URL.

EDIT LOOKBOOKS
Open lookbooks.js. A Lookbook has one cover image, title, board, category, description, and pieces[].
The pieces[] array contains product IDs from products.js.
Lookbook covers are displayed at 2:3. Product images keep their natural proportions.

CURRENT TEST LOOK
Streetwear Outfit Inspo contains p-a1, p-a2, and p-a3.

IMAGE INSPECTOR
Click an image to open the image-only inspector. Mouse wheel zooms, double-click toggles 2x zoom, and drag pans when zoomed. Esc, X, or clicking outside closes it.
The instructional help text is hidden from visitors.
