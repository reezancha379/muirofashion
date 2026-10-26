/**
 * Aspect-ratio matrix check: cycles every slide (portrait 640x1147, landscape 640x360,
 * square 480x480) and confirms EVERY slide's hero img is object-fit contain and stays
 * inside its 4:3 frame. Jumps straight to each slide via the pagination dots.
 * Usage: node scripts/cdp-ratios.mjs [URL]
 */
import { spawn } from 'node:child_process';

const BASE = process.argv[2] || 'http://127.0.0.1:3111';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const results = [];
let failures = 0;
const mark = (ok, msg) => { results.push({ ok, msg }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => resolve(ws);
    ws.onerror = reject;
  });
}
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map();
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { const { resolve, reject } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); }
    };
  }
  send(method, params = {}) { const id = ++this.id; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  async eval(expression) { const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); return r.result.value; }
}

const EVAL = String.raw`(() => {
  const frame = document.querySelector('[aria-roledescription="carousel"]');
  const cur = Array.from(frame.querySelectorAll(':scope > div')).find((s) => String(s.className).includes('opacity-100')) || frame;
  const img = Array.from(cur.querySelectorAll('img')).find((i) => getComputedStyle(i).objectFit === 'contain');
  if (!img) return { error: 'no contain img' };
  const ir = img.getBoundingClientRect();
  const sr = cur.getBoundingClientRect();
  const natW = img.naturalWidth, natH = img.naturalHeight;
  const ratio = natH ? Math.round((natW / natH) * 100) / 100 : null;
  return {
    inside: ir.x >= sr.x - 2 && ir.y >= sr.y - 2 && ir.x + ir.width <= sr.x + sr.width + 2 && ir.y + ir.height <= sr.y + sr.height + 2,
    imgFit: getComputedStyle(img).objectFit,
    imgObjectFitUnchanged: true,
    naturalW: img.naturalWidth, naturalH: img.naturalHeight,
    elementW: ir.width, elementH: ir.height,
    frameW: sr.width, frameH: sr.height,
    title: frame.querySelector('h2') ? frame.querySelector('h2').textContent : null,
    ctaTop: (() => { const cta = Array.from(frame.querySelectorAll('button')).find((b) => (b.textContent || '').includes('Pieces')); if (!cta) return 'no-cta'; const cr = cta.getBoundingClientRect(); return document.elementsFromPoint(cr.x + cr.width/2, cr.y + cr.height/2).slice(0,3).map(el => el.tagName).join(','); })(),
  };
})()`;

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9225', '--user-data-dir=' + process.env.TEMP + '\\muiro-cdp-ratios', 'about:blank'], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1500));
  const targets = await fetch('http://127.0.0.1:9225/json/list').then((r) => r.json());
  const cdp = new CDP(await connect((targets.find((t) => t.type === 'page') || targets[0]).webSocketDebuggerUrl));
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 2400, screenWidth: 1280, screenHeight: 2400, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: BASE + '/' });
  await new Promise((r) => setTimeout(r, 5000));

  // Walk through slides 1..4 by clicking dots directly.
  const dots = await cdp.eval(`(() => Array.from(document.querySelectorAll('[aria-roledescription="carousel"] > div button[aria-label^="Go to slide"]')).map((b) => b.getAttribute('aria-label')))()`);
  mark(dots.length >= 4, `found ${dots.length} pagination dots for ratio matrix`);

  for (let i = 0; i < dots.length; i++) {
    await cdp.eval(`(() => { const d = Array.from(document.querySelectorAll('[aria-roledescription="carousel"] > div button[aria-label^="Go to slide"]'))[${i}]; d.click(); })()`);
    await new Promise((r) => setTimeout(r, 1500)); // let crossfade finish
    const d = await cdp.eval(EVAL);
    if (d.error) { mark(false, `slide ${i + 1}: ${d.error}`); continue; }
    const ratio = Math.round((d.naturalW / d.naturalH) * 100) / 100;
    const label = ratio < 0.8 ? 'portrait' : (Math.abs(ratio - 1) < 0.15 ? 'square' : (ratio > 1.3 ? 'landscape' : 'other'));
    mark(d.imgFit === 'contain' && d.inside, `slide ${i + 1} (${label} ${d.naturalW}x${d.naturalH}): img contained, fit=${d.imgFit}`);
    mark(!d.ctaTop.includes('IMG'), `slide ${i + 1}: CTA hit-test top=${d.ctaTop} (not image)`);
    console.log(`     natural ${d.naturalW}x${d.naturalH} ratio=${ratio} element ${d.elementW.toFixed(0)}x${d.elementH.toFixed(0)} frame ${d.frameW.toFixed(0)}x${d.frameH.toFixed(0)} inside=${d.inside}`);
  }
  chrome.kill();
  console.log(`\nFAILURES=${failures}`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
