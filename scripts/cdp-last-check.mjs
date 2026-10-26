/**
 * Final integration check: loads the running MUIRO server, records console
 * errors / page JS exceptions, then confirms hero stacking + hit-test at
 * desktop/tablet/mobile.
 * Usage: node scripts/cdp-last-check.mjs [URL]
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
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
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
    return r.result.value;
  }
}

const EVAL = String.raw`(() => {
  const frame = document.querySelector('[aria-roledescription="carousel"]');
  if (!frame) return { error: 'no carousel' };
  const cur = Array.from(frame.querySelectorAll(':scope > div')).find((s) => String(s.className).includes('opacity-100')) || frame;
  const img = Array.from(cur.querySelectorAll('img')).find((i) => getComputedStyle(i).objectFit === 'contain');
  const ir = img.getBoundingClientRect(); const sr = cur.getBoundingClientRect();
  const cta = Array.from(frame.querySelectorAll('button')).find((b) => (b.textContent || '').includes('Pieces'));
  const cr = cta.getBoundingClientRect();
  const top = document.elementsFromPoint(cr.x + cr.width / 2, cr.y + cr.height / 2).slice(0, 3).map((el) => el.tagName);
  const nav = document.querySelector('nav, header, [class*="sticky"], [class*="fixed"]');
  return {
    frame: { x: sr.x, y: sr.y, w: sr.width, h: sr.height },
    imgInside: ir.x >= sr.x - 2 && ir.y >= sr.y - 2 && ir.x + ir.width <= sr.x + sr.width + 2 && ir.y + ir.height <= sr.y + sr.height + 2,
    imgZ: getComputedStyle(img).zIndex, imgFit: getComputedStyle(img).objectFit,
    ctaTop: top.join(','), ctaHitByImg: top.includes('IMG'),
    navBottom: nav ? nav.getBoundingClientRect().bottom : null,
    heroTop: sr.y,
    heading: !!frame.querySelector('h2'),
    noOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  };
})()`;

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9250', '--user-data-dir=' + process.env.TEMP + '\\muiro-cdp-live2', 'about:blank'], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2000));
  const targets = await fetch('http://127.0.0.1:9250/json/list').then((r) => r.json());
  const target = targets.find((t) => t.type === 'page') || targets[0];
  const cdp = new CDP(await connect(target.webSocketDebuggerUrl));

  // Console/exception capture on the SAME socket before navigation.
  const consoleErrors = [];
  const origHandler = cdp.ws.onmessage;
  cdp.ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.exceptionThrown') consoleErrors.push('EXCEPTION: ' + (m.params && m.params.exceptionDetails && m.params.exceptionDetails.text));
    if (m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'error') consoleErrors.push('CONSOLE: ' + (m.params.args || []).map((a) => a.value || a.description || '').join(' '));
    origHandler(ev);
  };

  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1400, screenWidth: 1280, screenHeight: 1400, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: BASE + '/' });
  await new Promise((r) => setTimeout(r, 15000));

  const viewports = [
    { name: 'desktop', width: 1280, height: 2400, mobile: false },
    { name: 'tablet', width: 768, height: 2000, mobile: false },
    { name: 'mobile', width: 390, height: 1600, mobile: true },
  ];
  for (const vp of viewports) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { ...vp, screenWidth: vp.width, screenHeight: vp.height, deviceScaleFactor: 1 });
    await new Promise((r) => setTimeout(r, 1300));
    const d = await cdp.eval(EVAL);
    if (!d || d.error) { mark(false, vp.name + ': ' + (d && d.error)); continue; }
    mark(d.imgFit === 'contain' && d.imgZ === '0', `${vp.name}: hero img object-fit=${d.imgFit} z=${d.imgZ} (contain, below overlay)`);
    mark(!!d.imgInside, `${vp.name}: hero img fully inside its own 4:3 region`);
    mark(!d.ctaHitByImg && d.ctaTop.includes('BUTTON'), `${vp.name}: CTA center hit-test top=${d.ctaTop} (button NOT image)`);
    mark(!!d.heading, `${vp.name}: heading present`);
    mark(!!d.noOverflow, `${vp.name}: no horizontal overflow`);
    if (d.navBottom !== null && d.heroTop !== null) {
      mark(d.heroTop >= d.navBottom - 2, `${vp.name}: hero top (${d.heroTop}) below header bottom (${d.navBottom})`);
    }
  }
  await new Promise((r) => setTimeout(r, 1500));
  mark(consoleErrors.length === 0, `no page console errors / exceptions on load (${consoleErrors.length})` + (consoleErrors.length ? '\n    ' + consoleErrors.join('\n    ') : ''));
  chrome.kill();
  console.log(`\nFAILURES=${failures}`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
