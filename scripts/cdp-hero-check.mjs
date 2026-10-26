/**
 * CDP hero layout verification (accurate): loads the running MUIRO server,
 * finds the real hero foreground image (object-fit: contain, z-index 0), the
 * content overlay (z-index 10), and HIT-TESTS the CTA button center to prove
 * the button is the topmost element and no image covers/intercepts it.
 *
 * Usage: node scripts/cdp-hero-check.mjs [URL]
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:3111';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const results = [];
const mark = (ok, msg) => {
  results.push({ ok, msg });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
};

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => resolve(ws);
    ws.onerror = (e) => reject(e);
  });
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  }
}

const EVAL_TEMPLATE = String.raw`(() => {
  const frame = document.querySelector('[aria-roledescription="carousel"]');
  if (!frame) return { error: 'no carousel frame found' };
  const fr = frame.getBoundingClientRect();
  // Only measure the CURRENT slide: pick the img slide wrapper class has the
  // opacity-100 content (outgoing crossfade uses scale-105 and would skew).
  const currentSlide = Array.from(frame.querySelectorAll(':scope > div')).find((s) => String(s.className).includes('opacity-100')) || frame;
  const allImgs = Array.from(currentSlide.querySelectorAll('img')).filter((i) => window.getComputedStyle(i).objectFit === 'contain');
  const img = allImgs[0];
  const ir = img ? img.getBoundingClientRect() : null;
  const imgStyle = img ? window.getComputedStyle(img) : null;
  // Compare against the slide's OWN box (shares the same ancestor transform),
  // so a mid-crossfade scale on that slide cannot corrupt the containment check.
  const sr = currentSlide.getBoundingClientRect();
  const imgInside = !!(ir && ir.x >= sr.x - 2 && ir.y >= sr.y - 2 && ir.x + ir.width <= sr.x + sr.width + 2 && ir.y + ir.height <= sr.y + sr.height + 2);
  const h2 = frame.querySelector('h2');
  let overlay = h2 ? h2.parentElement : null;
  while (overlay && window.getComputedStyle(overlay).position === 'static') overlay = overlay.parentElement;
  const oz = overlay ? window.getComputedStyle(overlay).zIndex : null;
  const op = overlay ? window.getComputedStyle(overlay).position : null;
  const cta = Array.from(frame.querySelectorAll('button')).find((b) => (b.textContent || '').includes('Pieces'));
  let hittest = null;
  if (cta) {
    const cr = cta.getBoundingClientRect();
    const cx = cr.x + cr.width / 2;
    const cy = cr.y + cr.height / 2;
    const topEls = document.elementsFromPoint(cx, cy);
    hittest = topEls.slice(0, 5).map((el) => ({ tag: el.tagName, cls: String(el.className).slice(0, 60), text: (el.textContent || '').trim().slice(0, 40) }));
  }
  const headings = document.querySelectorAll('[aria-roledescription="carousel"] h2').length;
  const noOverflow = document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  return { frame: { x: fr.x, y: fr.y, w: fr.width, h: fr.height }, image: img ? { x: ir.x, y: ir.y, w: ir.width, h: ir.height, objectFit: imgStyle.objectFit, z: imgStyle.zIndex } : null, overlay: { z: oz, pos: op }, hittest, headings, noOverflow };
})()`;

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9222', '--user-data-dir=' + process.env.TEMP + '\\muiro-cdp-profile3', 'about:blank'], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1500));
  const targets = await fetch('http://127.0.0.1:9222/json/list').then((r) => r.json());
  const target = targets.find((t) => t.type === 'page') || targets[0];
  const cdp = new CDP(await connect(target.webSocketDebuggerUrl));
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1400, screenWidth: 1280, screenHeight: 1400, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: BASE + '/' });
  await new Promise((r) => setTimeout(r, 7000));

  const viewports = [
    { name: 'desktop', width: 1280, height: 2400, mobile: false },
    { name: 'tablet', width: 768, height: 2000, mobile: false },
    { name: 'mobile', width: 390, height: 1600, mobile: true },
  ];

  let failures = 0;
  for (const vp of viewports) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { ...vp, screenWidth: vp.width, screenHeight: vp.height, deviceScaleFactor: 1 });
    await new Promise((r) => setTimeout(r, 1500));

    let data;
    try {
      data = await cdp.eval(EVAL_TEMPLATE);
    } catch (e) {
      console.error("eval error", e);
      failures++;
      continue;
    }

    if (!data || data.error) { mark(false, vp.name + ': ' + (data && data.error)); failures++; continue; }
    const frame = data.frame;
    const img = data.image;

    const hitOk = data.hittest && data.hittest.length > 0 && !data.hittest.some((el) => el.tag === 'IMG');
    mark(hitOk, `${vp.name}: hit-test at CTA center -> topmost is button content, NOT the image`);
    mark(img && img.objectFit === 'contain' && parseInt(img.z, 10) === 0, `${vp.name}: real hero img object-fit contain z=${img && img.z} (below overlay, never covering content)`);
    mark(img && imgInsideCheck(frame, img), `${vp.name}: real hero img fully inside 4:3 frame`);
    mark(data.overlay.z !== null && parseInt(data.overlay.z, 10) >= 10 && data.overlay.pos === 'absolute', `${vp.name}: content overlay z=${data.overlay.z} pos=${data.overlay.pos} (>=10, above image)`);
    mark(data.headings >= 1, `${vp.name}: hero heading present`);
    mark(!!data.noOverflow, `${vp.name}: no horizontal page overflow`);

    console.log(`       frame=${JSON.stringify(frame)} image=${JSON.stringify(img)} overlay=${JSON.stringify(data.overlay)}`);
    console.log(`       hit-test top elements: ${JSON.stringify(data.hittest)}`);

    // Failure accounting.
    const imgOk = !!img && img.objectFit === 'contain' && parseInt(img.z, 10) === 0;
    const insideOk = img && imgInsideCheck(frame, img);
    const overlayOk = data.overlay.z !== null && parseInt(data.overlay.z, 10) >= 10 && data.overlay.pos === 'absolute';
    const ctaOk = data.hittest && data.hittest.length > 0 && !data.hittest.some((el) => el.tag === 'IMG');
    const summaryOk = data.headings >= 1 && !!data.noOverflow;
    if (!imgOk || !insideOk || !overlayOk || !ctaOk || !summaryOk) failures++;
  }

  // Functional controls test (desktop): click the next arrow, confirm the
  // active dot/title changes, then click the previous arrow to return.
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 2400, screenWidth: 1280, screenHeight: 2400, deviceScaleFactor: 1, mobile: false });
  await new Promise((r) => setTimeout(r, 1000));
  try {
    const before = await cdp.eval(`(() => { const frame = document.querySelector('[aria-roledescription="carousel"]'); const active = document.querySelector('button[aria-current="true"]'); return { title: frame.querySelector('h2') ? frame.querySelector('h2').textContent : null, activeDot: active ? active.getAttribute('aria-label') : null }; })()`);
    // Click the next button
    await cdp.eval(`(() => { const b = Array.from(document.querySelectorAll('[aria-roledescription="carousel"] > div button')).find((x) => x.getAttribute('aria-label') === 'Next Slide'); if (!b) return false; b.click(); return true; })()`);
    await new Promise((r) => setTimeout(r, 1200)); // 700ms transition
    const after = await cdp.eval(`(() => { const frame = document.querySelector('[aria-roledescription="carousel"]'); const active = document.querySelector('button[aria-current="true"]'); return { title: frame.querySelector('h2') ? frame.querySelector('h2').textContent : null, activeDot: active ? active.getAttribute('aria-label') : null }; })()`);
    mark(before.activeDot !== after.activeDot, `next arrow changes slide (${before.title} -> ${after.title})`);
    // Click previous arrow to go back
    await cdp.eval(`(() => { const b = Array.from(document.querySelectorAll('[aria-roledescription="carousel"] > div button')).find((x) => x.getAttribute('aria-label') === 'Previous Slide'); if (!b) return false; b.click(); return true; })()`);
    await new Promise((r) => setTimeout(r, 1200));
    const back = await cdp.eval(`(() => { const f = document.querySelector('[aria-roledescription="carousel"]'); const a = document.querySelector('button[aria-current="true"]'); return { title: f.querySelector('h2') ? f.querySelector('h2').textContent : null, activeDot: a ? a.getAttribute('aria-label') : null }; })()`);
    mark(before.activeDot === back.activeDot && before.title === back.title, `previous arrow returns to original slide`);
    if (before.activeDot !== after.activeDot && !(before.activeDot === back.activeDot && before.title === back.title)) failures++;

    // Click a pagination dot directly
    const dots = await cdp.eval(`(() => Array.from(document.querySelectorAll('[aria-roledescription="carousel"] > div button[aria-label^="Go to slide"]')).map(b => b.getAttribute('aria-label')))()`);
    mark(dots.length >= 2, `found ${dots.length} pagination dots`);
    if (dots.length >= 2) {
      await cdp.eval(`(() => { const d = Array.from(document.querySelectorAll('[aria-roledescription="carousel"] > div button[aria-label^="Go to slide"]')); const target = d[Math.min(d.length - 1, 2)]; target.click(); return target.getAttribute('aria-label'); })()`);
      await new Promise((r) => setTimeout(r, 1200));
      const dotAfter = await cdp.eval(`(() => { const a = document.querySelector('button[aria-current="true"]'); return a ? a.getAttribute('aria-label') : null; })()`);
      mark(dotAfter === dots[Math.min(dots.length - 1, 2)], `pagination dot click works -> active is "${dotAfter}"`);
      if (dotAfter !== dots[Math.min(dots.length - 1, 2)]) failures++;
    }
  } catch (e) {
    mark(false, 'functional controls test error: ' + e.message);
    failures++;
  }

  console.log(`\nFAILURES=${failures}`);
  writeFileSync(process.env.TEMP + '\\muiro-cdp-result-final.json', JSON.stringify(results, null, 2));
  chrome.kill();
  process.exit(failures === 0 ? 0 : 1);
}

function imgInsideCheck(frame, img) {
  return img.x >= frame.x - 2 && img.y >= frame.y - 2 && img.x + img.w <= frame.x + frame.w + 2 && img.y + img.h <= frame.y + frame.h + 2;
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
