// heb.com lookup helpers. These run INSIDE a heb.com tab in Chrome (through
// Claude in Chrome's javascript tool), as a guest with H-E-B Main St (store 789)
// selected. The static site never calls heb.com itself.
//
// Verified Oct 21, 2026: ~0.4s per lookup, prices/aisles/flags are store-specific,
// no bot check across 70+ requests when spaced ~0.7s apart.

// Search by text. Returns the first n product cards with id, name, badge,
// price, aisle. Used when pinning a NEW pantry item to a product id.
window.hebLookup = async function (queries, n = 6, delay = 1500) {
  const res = {};
  const q$ = (el, s) => { const e = el.querySelector(s); return e ? e.textContent.trim() : null; };
  for (const q of queries) {
    const t0 = performance.now();
    let html;
    try { html = await fetch('/search?q=' + encodeURIComponent(q), { credentials: 'include' }).then(r => r.text()); }
    catch (e) { res[q] = { error: String(e) }; continue; }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const bot = /unusual browsing|verify you are human|access denied/i.test(doc.body.textContent);
    const cards = [...doc.querySelectorAll('[data-qe-id="productCard"]')].slice(0, n).map(c => {
      const a = c.querySelector('a[href*="/product-detail/"]');
      const txt = c.textContent;
      return {
        id: a ? a.getAttribute('href').split('/').pop() : null,
        name: q$(c, '[data-qe-id="productTitle"]'),
        badge: q$(c, '[data-qe-id="saleLabel"]') || '',
        was: q$(c, '[data-component="product-price-strike-through-price"]'),
        price: q$(c, '[data-component="product-price-sale-price"]') || (q$(c, '[data-component="product-price-price"]') || '').replace(/\s*each.*$/, ''),
        per: q$(c, '[data-component="product-price-price-per-unit"]'),
        aisle: (txt.match(/(In [A-Z][^$]*?(Wall|Display|Market|Produce|Deli|Dairy|Bakery)|Aisle \d+|Back Edge of Deli|On the [A-Za-z ]+ of [A-Za-z ]+)/) || [''])[0].replace(/Add to cart.*$/, '').trim(),
        oos: /Out of stock/.test(txt),
      };
    });
    res[q] = { ms: Math.round(performance.now() - t0), bot, cards };
    await new Promise(r => setTimeout(r, delay));
  }
  return res;
};

// Re-price by product id. Reads the structured data on each product page.
// This is the weekly refresh: pass every products[].hebId in data/pantry.json
// (preferred AND fallback products), write the result into data/prices.json
// keyed by hebId, with today's pull date. The app picks between candidates itself.
window.hebPrices = async function (ids, delay = 700) {
  const out = []; let bots = 0; const t0 = performance.now();
  for (const id of ids) {
    try {
      const r = await fetch('/product-detail/x/' + id, { credentials: 'include' });
      const txt = await r.text();
      if (/unusual browsing/i.test(txt)) { bots++; out.push({ id, error: 'bot-check' }); await new Promise(r => setTimeout(r, 5000)); continue; }
      const doc = new DOMParser().parseFromString(txt, 'text/html');
      const nd = doc.getElementById('__NEXT_DATA__');
      if (!nd) { out.push({ id, error: 'no-data', status: r.status }); continue; }
      const j = JSON.parse(nd.textContent); let prod = null;
      (function walk(o) { if (prod || !o || typeof o !== 'object') return; if (o.__typename === 'Product' && o.SKUs) { prod = o; return; } for (const k in o) walk(o[k]); })(j);
      if (!prod) { out.push({ id, error: 'no-product' }); continue; }
      const sku = prod.SKUs[0];
      const cp = (sku.contextPrices || []).find(p => p.context === 'ONLINE') || sku.contextPrices[0];
      const c = (prod.coupons || [])[0];
      out.push({
        id,
        name: prod.fullDisplayName,
        size: sku.customerFriendlySize || null,
        store: prod.store ? prod.store.storeNumber : null,   // must be 789
        aisle: prod.productLocation ? prod.productLocation.location : null,
        available: prod.productLocation ? prod.productLocation.availability === 'AVAILABLE' : null,
        listPrice: cp.listPrice ? cp.listPrice.amount : null,
        price: cp.salePrice ? cp.salePrice.amount : (cp.listPrice ? cp.listPrice.amount : null),
        onSale: !!cp.isOnSale,
        priceCut: !!cp.isPriceCut,
        onAd: !!prod.onAd,
        coupon: c ? { desc: c.description, exp: c.expirationDate, type: c.type } : null,
      });
    } catch (e) { out.push({ id, error: String(e) }); }
    await new Promise(r => setTimeout(r, delay));
  }
  return { ms: Math.round(performance.now() - t0), bots, out };
};
