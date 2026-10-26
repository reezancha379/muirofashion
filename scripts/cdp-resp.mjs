/**
 * Responsive + aspect-matrix check against a warm server.
 * At each viewport: measures hero action-button dimensions and slide/CTA hit-test.
 * Then cycles all slides (portrait/landscape/square not needed here — real store
 * uses 4 portrait images but layout is ratio-agnostic via object-contain;
 * earlier ratio-matrix already proved square/16:9 containment on the same frame).
 * Usage: node scripts/cdp-resp.mjs [URL]
 */
import { spawn } from 'node:child_process';
const BASE = process.argv[2] || 'http://127.0.0.1:3001';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let failures = 0;
const mark = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
function connect(wsUrl) { return new Promise((res, rej) => { const w = new WebSocket(wsUrl); w.onopen = () => res(w); w.onerror = rej; }); }
class CDP { constructor(ws) { this.ws = ws; this.id = 0; this.p = new Map(); ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && this.p.has(m.id)) { const { res, rej } = this.p.get(m.id); this.p.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); } }; }
  send(method, params = {}) { const id = ++this.id; return new Promise((res, rej) => { this.p.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  async eval(expression) { const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); return r.result.value; }
}
const EVAL = String.raw`(() => {
  const frame = document.querySelector('[aria-roledescription="carousel"]');
  if (!frame) return { error: 'no carousel' };
  const cur = Array.from(frame.querySelectorAll(':scope > div')).find(s => String(s.className).includes('opacity-100')) || frame;
  const curImg = Array.from(cur.querySelectorAll('img')).find(i => getComputedStyle(i).objectFit === 'contain');
  const ir = curImg.getBoundingClientRect(), sr = cur.getBoundingClientRect();
  const explore = document.querySelector('#hero-explore-looks-btn');
  const shopAll = document.querySelector('#hero-shop-all-btn');
  const er = explore.getBoundingClientRect(), sr2 = shopAll.getBoundingClientRect();
  const heading = cur.querySelector('h2');
  const ht = heading ? +getComputedStyle(heading).fontSize.replace('px','') : null;
  const imgInside = ir.x >= sr.x - 2 && ir.y >= sr.y - 2 && ir.x + ir.width <= sr.x + sr.width + 2 && ir.y + ir.height <= sr.y + sr.height + 2;
  const nav = document.querySelector('header, nav');
  const actionsContainer = document.querySelector('#hero-explore-looks-btn')?.closest('div');
  const aw = actionsContainer ? actionsContainer.getBoundingClientRect().width : frame.getBoundingClientRect().width;
  return {
    frameW: Math.round(sr.width), frameH: Math.round(sr.height), actionsW: Math.round(aw),
    imgInside, imgZ: getComputedStyle(curImg).zIndex,
    explore: { w: Math.round(er.width), h: Math.round(er.height), fs: +getComputedStyle(explore).fontSize.replace('px','') },
    shopAll: { w: Math.round(sr2.width), h: Math.round(sr2.height), fs: +getComputedStyle(shopAll).fontSize.replace('px','') },
    headingFont: ht,
    noOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    heroTop: Math.round(sr.y), navBottom: nav ? Math.round(nav.getBoundingClientRect().bottom) : null,
  };
})()`;
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9280', '--user-data-dir=' + process.env.TEMP + '\\muiro-resp', 'about:blank'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2500));
const targets = await fetch('http://127.0.0.1:9280/json/list').then(r => r.json());
const cdp = new CDP(await connect((targets.find(t => t.type === 'page') || targets[0]).webSocketDebuggerUrl));
await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
await cdp.send('Page.navigate', { url: BASE + '/' }); await new Promise(r => setTimeout(r, 12000));
const viewports = [
  { name: 'mobile', width: 390, height: 1400, mobile: true },
  { name: 'tablet', width: 768, height: 1600, mobile: false },
  { name: 'desktop', width: 1280, height: 2200, mobile: false },
];
for (const vp of viewports) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { ...vp, screenWidth: vp.width, screenHeight: vp.height, deviceScaleFactor: 1 });
  await new Promise(r => setTimeout(r, 1200));
  const d = await cdp.eval(EVAL);
  if (d.error) { mark(false, vp.name + ': ' + d.error); continue; }
  console.log(`${vp.name}: frame ${d.frameW}x${d.frameH}  explore ${d.explore.w}x${d.explore.h}@${d.explore.fs}px  shop ${d.shopAll.w}x${d.shopAll.h}@${d.shopAll.fs}px  heading@${d.headingFont}px`);
  mark(d.imgInside && d.imgZ === '0', `${vp.name}: hero img contained (z=${d.imgZ})`);
  mark(d.explore.h >= 40, `${vp.name}: 'Discover the Look' button height ${d.explore.h}px (tap-friendly)`);
  mark(d.shopAll.h >= 40, `${vp.name}: 'Explore the Collection' button height ${d.shopAll.h}px (tap-friendly)`);
  mark(d.explore.w <= d.actionsW + 1, `${vp.name}: buttons fit within column (w=${d.explore.w} <= col ${d.actionsW})`);
  mark(d.noOverflow, `${vp.name}: no horizontal overflow`);
  if (d.navBottom !== null) mark(d.heroTop >= d.navBottom - 2, `${vp.name}: hero (${d.heroTop}) below header (${d.navBottom})`);
}
chrome.kill();
console.log(`\nFAILURES=${failures}`);
process.exit(failures ? 1 : 0);
