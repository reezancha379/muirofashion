(function () {
  'use strict';

  const products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  const looks = Array.isArray(window.LOOKBOOKS) ? window.LOOKBOOKS : [];
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const wishlistKey = 'muiro_wishlist';

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }
  const attr = escapeHtml;

  function getWishlist() {
    try { return JSON.parse(localStorage.getItem(wishlistKey) || '[]'); }
    catch { return []; }
  }
  function setWishlist(list) {
    localStorage.setItem(wishlistKey, JSON.stringify(list));
    updateWishlistBadge();
  }
  function isSaved(id) { return getWishlist().includes(id); }
  function toggleSave(id) {
    const list = getWishlist();
    const index = list.indexOf(id);
    if (index >= 0) list.splice(index, 1); else list.push(id);
    setWishlist(list);
    return list;
  }
  function updateWishlistBadge() {
    const badge = $('#wishlistCount');
    if (!badge) return;
    const count = getWishlist().length;
    badge.textContent = count;
    badge.style.display = count ? 'flex' : 'none';
  }

  function productCard(product) {
    const affiliate = product.affiliate || product.link || '#';
    return `
      <article class="card product-card" data-id="${attr(product.id)}" data-cat="${attr(product.category || 'Other')}" data-board="${attr(product.board || '')}" data-title="${attr(product.title || '')}">
        <div class="product-img">
          <img src="${attr(product.image)}" alt="${attr(product.title)}" data-inspect data-inspect-alt="${attr(product.title)}" loading="lazy">
        </div>
        <div class="product-body">
          <div class="board">${escapeHtml(product.board || product.category || 'MUIRO')}</div>
          <h3 class="product-title">${escapeHtml(product.title)}</h3>
          <div class="price">${escapeHtml(product.price || '')}</div>
          ${product.description ? `<p class="muted">${escapeHtml(product.description)}</p>` : ''}
          <div class="product-actions">
            <button class="save ${isSaved(product.id) ? 'saved' : ''}" type="button" data-save="${attr(product.id)}" aria-label="${isSaved(product.id) ? 'Remove from wishlist' : 'Save'} ${attr(product.title)}">♥</button>
            <a class="btn dark" href="${attr(affiliate)}" target="_blank" rel="nofollow sponsored noopener">Shop</a>
          </div>
        </div>
      </article>`;
  }

  function lookCard(look) {
    return `
      <article class="card look-card" data-look-id="${attr(look.id)}" data-title="${attr(((look.title || '') + ' ' + (look.board || '')).toLowerCase())}">
        <button class="look-cover-button" type="button" data-open-look="${attr(look.id)}" aria-label="Open ${attr(look.title)}">
          <span class="card-cover"><img src="${attr(look.cover)}" alt="${attr(look.title)}" loading="lazy"></span>
        </button>
        <div class="card-body">
          <div class="board">${escapeHtml(look.board || 'Lookbook')}</div>
          <h3>${escapeHtml(look.title)}</h3>
          ${look.description ? `<p class="muted">${escapeHtml(look.description)}</p>` : ''}
          <button class="btn" type="button" data-open-look="${attr(look.id)}">Open Look</button>
        </div>
      </article>`;
  }

  function wireSaves(root = document) {
    $$('[data-save]', root).forEach(button => {
      if (button.dataset.wired) return;
      button.dataset.wired = '1';
      button.addEventListener('click', () => {
        toggleSave(button.dataset.save);
        const saved = isSaved(button.dataset.save);
        button.classList.toggle('saved', saved);
        button.setAttribute('aria-label', saved ? 'Remove from wishlist' : 'Save product');
      });
    });
  }

  function renderShop(list = products) {
    const host = $('#productGrid');
    if (!host) return;
    host.innerHTML = list.length
      ? list.map(productCard).join('')
      : '<div class="empty">No matching products. Add products in <strong>products.js</strong>.</div>';
    wireSaves(host);
    wireInspect(host);
  }

  function renderLooks() {
    const host = $('#lookGrid');
    if (!host) return;
    host.innerHTML = looks.length
      ? looks.map(lookCard).join('')
      : '<div class="empty">No Lookbooks yet. Add one in <strong>lookbooks.js</strong>.</div>';
    $$('[data-open-look]', host).forEach(button => {
      if (button.dataset.wired) return;
      button.dataset.wired = '1';
      button.addEventListener('click', event => {
        event.preventDefault();
        openLook(button.dataset.openLook);
      });
    });
  }

  function openLook(id) {
    const look = looks.find(item => item.id === id);
    const detail = $('#lookDetail');
    const grid = $('#lookGrid');
    const searchWrap = $('#lookSearchWrap');
    if (!look || !detail || !grid) return;

    grid.style.display = 'none';
    if (searchWrap) searchWrap.style.display = 'none';
    detail.classList.add('open');

    const pieceIds = Array.isArray(look.pieces) ? look.pieces : (Array.isArray(look.items) ? look.items.map(item => item.id) : []);
    const pieces = pieceIds
      .map(pieceId => products.find(product => product.id === pieceId))
      .filter(Boolean);

    detail.innerHTML = `
      <div class="detail-top">
        <div class="detail-cover">
          <img src="${attr(look.cover)}" alt="${attr(look.title)}" data-inspect loading="eager">
        </div>
        <div class="detail-copy">
          <div class="board">${escapeHtml(look.board || 'Lookbook')}</div>
          <h1>${escapeHtml(look.title)}</h1>
          ${look.description ? `<p class="muted">${escapeHtml(look.description)}</p>` : ''}
          <button class="btn" id="backLooks" type="button">← Back to Lookbooks</button>
        </div>
      </div>
      <section class="pieces">
        <div class="section-head">
          <div><div class="caps muted">This look</div><h2>Pieces in this look</h2></div>
          <span class="muted piece-count">${pieces.length} ${pieces.length === 1 ? 'piece' : 'pieces'}</span>
        </div>
        <div class="product-grid" id="pieceGrid"></div>
      </section>`;

    const pieceGrid = $('#pieceGrid', detail);
    pieceGrid.innerHTML = pieces.length
      ? pieces.map(productCard).join('')
      : '<div class="empty">No pieces have been assigned to this Lookbook yet. Add product IDs to <strong>pieces</strong> in lookbooks.js.</div>';

    $('#backLooks', detail)?.addEventListener('click', () => {
      detail.classList.remove('open');
      detail.innerHTML = '';
      grid.style.display = '';
      if (searchWrap) searchWrap.style.display = '';
      const url = new URL(location.href);
      url.searchParams.delete('look');
      history.pushState({}, '', url);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    wireSaves(detail);
    wireInspect(detail);
    history.replaceState({}, '', `lookbook.html?look=${encodeURIComponent(id)}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function initShop() {
    const bar = $('#filterBar');
    const search = $('#productSearch');
    const params = new URLSearchParams(location.search);
    let active = params.get('cat') || (params.get('wishlist') === '1' ? 'Saved' : 'All');

    if (bar) {
      const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
      const boards = [...new Set(products.map(p => p.board).filter(Boolean))];
      bar.innerHTML = ['All', 'Saved', ...categories, ...boards]
        .filter((value, index, arr) => arr.indexOf(value) === index)
        .map(value => `<button class="filter" type="button" data-filter="${attr(value)}">${escapeHtml(value)}</button>`)
        .join('');
    }

    function apply() {
      const query = (search?.value || '').trim().toLowerCase();
      let list = products;
      if (active === 'Saved') list = list.filter(p => isSaved(p.id));
      else if (active !== 'All') list = list.filter(p => p.category === active || p.board === active);
      if (query) list = list.filter(p => `${p.title} ${p.board} ${p.category}`.toLowerCase().includes(query));
      renderShop(list);
      if (bar) $$('[data-filter]', bar).forEach(button => button.classList.toggle('active', button.dataset.filter === active));
    }

    bar?.addEventListener('click', event => {
      const button = event.target.closest('[data-filter]');
      if (!button) return;
      active = button.dataset.filter;
      apply();
    });
    search?.addEventListener('input', apply);
    apply();
  }

  function initLooks() {
    renderLooks();
    const input = $('#lookSearch');
    input?.addEventListener('input', () => {
      const query = input.value.trim().toLowerCase();
      $$('.look-card').forEach(card => {
        card.style.display = !query || card.dataset.title.includes(query) ? '' : 'none';
      });
    });
  }

  function initHome() {
    const productHost = $('#homeProducts');
    const lookHost = $('#homeLooks');
    if (productHost) productHost.innerHTML = products.slice(0, 4).map(productCard).join('');
    if (lookHost) lookHost.innerHTML = looks.slice(0, 3).map(lookCard).join('');
    wireSaves();
    wireInspect();
    $$('.look-card [data-open-look]').forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        location.href = `lookbook.html?look=${encodeURIComponent(button.dataset.openLook)}`;
      });
    });
  }

  /* =========================================================
     IMAGE INSPECTOR
     Cover images on the Lookbook LIST open the Lookbook.
     Cover images INSIDE a Lookbook are inspectable.
     Product images are always inspectable.
     ========================================================= */
  let scale = 1, x = 0, y = 0, dragging = false, startX = 0, startY = 0;
  const inspector = $('#imageInspector');
  const stage = $('#imageInspectorStage');
  const inspectorImage = $('#imageInspectorImage');

  function updateTransform() {
    if (inspectorImage) inspectorImage.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  }
  function resetInspector() {
    scale = 1; x = 0; y = 0; updateTransform();
  }
  function openInspector(source) {
    if (!inspector || !inspectorImage) return;
    inspectorImage.src = source.currentSrc || source.src;
    inspectorImage.alt = source.alt || 'MUIRO image';
    resetInspector();
    inspector.classList.add('open');
    inspector.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lock');
    requestAnimationFrame(() => inspector.classList.add('visible'));
  }
  function closeInspector() {
    if (!inspector) return;
    inspector.classList.remove('visible');
    inspector.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lock');
    setTimeout(() => {
      if (!inspector.classList.contains('visible')) inspector.classList.remove('open');
      if (inspectorImage) inspectorImage.src = '';
    }, 220);
  }
  function wireInspect(root = document) {
    $$('[data-inspect]', root).forEach(image => {
      if (image.dataset.inspectWired) return;
      image.dataset.inspectWired = '1';
      image.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openInspector(image);
      });
    });
  }

  if (stage) {
    stage.addEventListener('wheel', event => {
      if (!inspector?.classList.contains('open')) return;
      event.preventDefault();
      const direction = event.deltaY < 0 ? 0.15 : -0.15;
      scale = Math.max(1, Math.min(5, scale + direction));
      if (scale === 1) { x = 0; y = 0; }
      updateTransform();
    }, { passive: false });

    stage.addEventListener('pointerdown', event => {
      if (scale <= 1) return;
      dragging = true;
      startX = event.clientX - x;
      startY = event.clientY - y;
      stage.classList.add('dragging');
      stage.setPointerCapture?.(event.pointerId);
    });
    stage.addEventListener('pointermove', event => {
      if (!dragging) return;
      x = event.clientX - startX;
      y = event.clientY - startY;
      updateTransform();
    });
    ['pointerup', 'pointercancel'].forEach(type => stage.addEventListener(type, event => {
      dragging = false;
      stage.classList.remove('dragging');
      try { stage.releasePointerCapture?.(event.pointerId); } catch {}
    }));
    stage.addEventListener('dblclick', event => {
      event.preventDefault();
      scale = scale === 1 ? 2 : 1;
      if (scale === 1) { x = 0; y = 0; }
      updateTransform();
    });
  }

  $('#imageInspectorClose')?.addEventListener('click', closeInspector);
  inspector?.addEventListener('click', event => {
    if (event.target === inspector || event.target === stage) closeInspector();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeInspector();
  });

  function initNav() {
    const menu = $('#mobileMenu');
    const overlay = $('#mobileOverlay');
    const close = () => { menu?.classList.remove('open'); overlay?.classList.remove('open'); };
    $('#menuBtn')?.addEventListener('click', () => { menu?.classList.add('open'); overlay?.classList.add('open'); });
    $('#closeMobile')?.addEventListener('click', close);
    overlay?.addEventListener('click', close);
    updateWishlistBadge();
    $('#wishlistBtn')?.addEventListener('click', () => { location.href = 'shop.html?wishlist=1'; });
  }

  window.addEventListener('popstate', () => {
    if ($('#lookGrid') && $('#lookDetail')?.classList.contains('open')) {
      const id = new URLSearchParams(location.search).get('look');
      if (id) openLook(id);
      else location.reload();
    }
  });

  function initScrollReveal() {
    const targets = $$('.section, .hero > *, .grid .card, .product-card, .detail-top, .pieces');
    if (!('IntersectionObserver' in window)) return;
    targets.forEach(el => el.classList.add('muiro-reveal'));
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    targets.forEach(el => observer.observe(el));
  }

  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    if ($('#productGrid')) initShop();
    if ($('#lookGrid')) {
      initLooks();
      const id = new URLSearchParams(location.search).get('look');
      if (id) openLook(id);
    }
    if ($('#homeProducts')) initHome();
    wireInspect();
    initScrollReveal();
  });
})();
