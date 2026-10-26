/**
 * Live app inspection: loads the running MUIRO app, waits generously, and
 * reports the ACTUAL rendered hero DOM — not just one aria selector. Dumps:
 *  - carousel / section presence via multiple strategies
 *  - hero slide headings/taglines/tags
 *  - action button text ("Explore the Collection", "Discover the Look")
 *  - nav arrows + pagination dots presence
 *  - the Collections label
 * Usage: node scripts/cdp-probe.mjs [URL]
 */
import { spawn } from 'node:child_process';

const BASE = process.argv[2] || 'http://127.0.0.1:3001';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

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
  async eval(expression) { const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return { __exception: r.exceptionDetails.text }; return r.result.value; }
}

const EVAL = String.raw`(() => {
  const bodyText = document.body ? document.body.innerText : '';
  // Multiple strategies for the hero region
  const byRole = document.querySelector('[aria-roledescription="carousel"]');
  const heroSection = document.querySelector('section');
  const byCta = Array.from(document.querySelectorAll('button')).filter(b => (b.textContent || '').includes('Explore the Collection'));
  const exploreBtn = byCta[0] || null;
  const discoverBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Discover the Look')) || null;
  const headings = Array.from(document.querySelectorAll('h1,h2,h3')).map(h => ({ tag: h.tagName, text: h.textContent.trim().slice(0, 60) })).slice(0, 12);
  const arrows = Array.from(document.querySelectorAll('button')).filter(b => /Previous Slide|Next Slide/.test(b.getAttribute('aria-label') || ''));
  const dots = Array.from(document.querySelectorAll('button[aria-label^="Go to slide"]'));
  const imgs = Array.from(document.images).map(i => ({ src: i.src.slice(0, 80), alt: (i.alt || '').slice(0, 40), w: i.naturalWidth, h: i.naturalHeight }));
  const navCollections = Array.from(document.querySelectorAll('nav,header,footer,button,span,a'))
    .filter(el => (el.textContent || '').trim() === 'Collections').length;
  return {
    url: location.href,
    title: document.title,
    readyState: document.readyState,
    bodyLen: bodyText.length,
    byRole: !!byRole,
    byRoleCount: document.querySelectorAll('[aria-roledescription="carousel"]').length,
    heroSectionTag: heroSection ? heroSection.className.slice(0, 60) : null,
    exploreBtnText: exploreBtn ? exploreBtn.textContent.trim().slice(0, 50) : null,
    discoverBtnText: discoverBtn ? discoverBtn.textContent.trim().slice(0, 50) : null,
    arrowsCount: arrows.length,
    dotsCount: dots.length,
    headings,
    imgCount: imgs.length,
    firstImgs: imgs.slice(0, 4),
    hasCollectionsLabel: navCollections,
    textHasExplore: bodyText.includes('Explore the Collection'),
    textHasDiscover: bodyText.includes('Discover the Look'),
    textHasCollections: bodyText.includes('Collections'),
    textHasAutumn: bodyText.includes('Autumn Essentials'),
    dataError: bodyText.includes('The server is taking too long'),
    noOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  };
})()`;

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9270', '--user-data-dir=' + process.env.TEMP + '\\muiro-probe2', 'about:blank'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const targets = await fetch('http://127.0.0.1:9270/json/list').then((r) => r.json());
const cdp = new CDP(await connect((targets.find((t) => t.type === 'page') || targets[0]).webSocketDebuggerUrl));
const consoleErrors = [];
const onmsg = cdp.ws.onmessage;
cdp.ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.exceptionThrown') consoleErrors.push('EXC: ' + (m.params && m.params.exceptionDetails && m.params.exceptionDetails.text));
  if (m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'error') consoleErrors.push('CONSOLE: ' + (m.params.args || []).map((a) => a.value || a.description || '').join(' '));
  onmsg(ev);
};
await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
await cdp.send('Page.navigate', { url: BASE + '/' });
await new Promise((r) => setTimeout(r, 15000));
const d = await cdp.eval(EVAL);
console.log(JSON.stringify(d, null, 2));
await new Promise((r) => setTimeout(r, 1000));
console.log('CONSOLE_ERRORS=', JSON.stringify(consoleErrors));
chrome.kill();
process.exit(0);
