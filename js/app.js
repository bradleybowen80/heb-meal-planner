/* Dinner this week: planner + shopping list. Vanilla JS, no build step. */
(async function () {
  'use strict';

  const DAYS = [
    { id: 'sun', name: 'Sun', theme: 'Church potluck', buckets: ['potluck', 'pizza', 'bbq'] },
    { id: 'mon', name: 'Mon', theme: 'Easy or out', buckets: ['easy'] },
    { id: 'tue', name: 'Tue', theme: 'Tacos', buckets: ['tacos'] },
    { id: 'wed', name: 'Wed', theme: 'Pasta or pork', buckets: ['pasta', 'pork'] },
    { id: 'thu', name: 'Thu', theme: 'Meat and three', buckets: ['meat-and-three'] },
    { id: 'fri', name: 'Fri', theme: 'Out', buckets: [] },
    { id: 'sat', name: 'Sat', theme: 'Pizza or BBQ', buckets: ['pizza', 'bbq'] },
  ];
  const THEME_NAMES = {
    potluck: 'Dish to bring', easy: 'Easy', tacos: 'Tacos', pasta: 'Pasta', pork: 'Pork',
    'meat-and-three': 'Meat and three', pizza: 'Pizza', bbq: 'BBQ', wildcard: 'Wildcard',
  };
  const STORE_KEY = 'hmp.plan.v1';
  const UI_KEY = 'hmp.ui.v1';
  const FAM_KEY = 'hmp.family';
  const DB = 'https://heb-meal-planner-abf0c-default-rtdb.firebaseio.com';

  // ---------- data ----------
  const [pantryDoc, mealsDoc, pricesDoc, checklistDoc, planSeed] = await Promise.all(
    ['pantry', 'meals', 'prices', 'checklist', 'plan'].map(n => fetch(`data/${n}.json`, { cache: 'no-cache' }).then(r => r.json()))
  );
  const pantry = Object.fromEntries(pantryDoc.items.map(i => [i.key, i]));
  const prices = pricesDoc.prices;
  const meals = Object.fromEntries(mealsDoc.meals.map(m => [m.id, m]));
  const sectionOrder = pantryDoc.sectionOrder;

  // Family key: a long random code that names this family's spot in the database.
  // It rides in the share link (?f=...). Anyone with the link sees the same plan.
  const family = (() => {
    const fromUrl = new URLSearchParams(location.search).get('f');
    let key = null;
    try { key = localStorage.getItem(FAM_KEY); } catch (e) { /* ignore */ }
    if (fromUrl && /^[A-Za-z0-9_-]{20,}$/.test(fromUrl) && fromUrl !== key) {
      key = fromUrl;
      try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }   // the shared plan wins; this phone's old copy goes
      setTimeout(() => toast('Joined the shared plan'), 400);
    }
    if (!key || key.length < 20) key = [...crypto.getRandomValues(new Uint8Array(24))].map(b => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 62]).join('');
    try { localStorage.setItem(FAM_KEY, key); } catch (e) { /* ignore */ }
    if (fromUrl) history.replaceState(null, '', location.pathname);
    return key;
  })();
  const remoteUrl = path => `${DB}/families/${family}/${path}.json`;

  let plan = loadPlan();
  function loadPlan() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (saved && (saved.updatedAt || saved.weekOf >= planSeed.weekOf)) return normalize(saved);
    } catch (e) { /* fall through */ }
    return normalize(structuredClone(planSeed));
  }
  function normalize(p) {
    p.days = p.days || {}; for (const d of DAYS) if (p.days[d.id] === undefined) p.days[d.id] = null;
    if (!p.checklist || !Object.keys(p.checklist).length) p.checklist = { ...checklistDoc.defaults };
    p.have = p.have || []; p.packs = p.packs || {}; p.extras = p.extras || {};
    p.budget = Number(p.budget || 0); p.potluckTheme = p.potluckTheme || '';
    if (p.updatedAt) p.syncedOnce = true;
    return p;
  }
  function persist() { plan.updatedAt = Math.max(Date.now(), (plan.updatedAt || 0) + 1); try { localStorage.setItem(STORE_KEY, JSON.stringify(plan)); } catch (e) { /* private mode */ } queuePush(); }
  function save() { persist(); render(); }

  // ---------- sync ----------
  // The database holds one copy of the plan per family. Every change here is pushed within
  // half a second; every few seconds we check for changes from the other phone. Newest wins.
  let pushTimer = null, dirty = false, inFlight = false, etag = null, syncState = 'idle', booted = false;
  let lastSynced = null;   // the plan as the database last had it, for working out what this phone changed
  const snapshot = () => JSON.parse(JSON.stringify(plan));
  // Which parts of the plan differ between two copies. Granular where two phones plausibly touch different things.
  function changedPaths(a, b) {
    const out = []; a = a || {}; b = b || {};
    const same = (x, y) => JSON.stringify(x === undefined ? null : x) === JSON.stringify(y === undefined ? null : y);
    for (const id of DAYS.map(d => d.id)) if (!same((a.days || {})[id], (b.days || {})[id])) out.push(['days', id]);
    for (const k of new Set([...Object.keys(a.checklist || {}), ...Object.keys(b.checklist || {})])) if (!same((a.checklist || {})[k], (b.checklist || {})[k])) out.push(['checklist', k]);
    for (const k of new Set([...Object.keys(a.packs || {}), ...Object.keys(b.packs || {})])) if (!same((a.packs || {})[k], (b.packs || {})[k])) out.push(['packs', k]);
    for (const k of new Set([...Object.keys(a.extras || {}), ...Object.keys(b.extras || {})])) if (!same((a.extras || {})[k], (b.extras || {})[k])) out.push(['extras', k]);
    const ha = new Set(a.have || []), hb = new Set(b.have || []);
    for (const k of hb) if (!ha.has(k)) out.push(['have+', k]);
    for (const k of ha) if (!hb.has(k)) out.push(['have-', k]);
    for (const k of ['spent', 'budget', 'potluckTheme', 'weekOf']) if (!same(a[k], b[k])) out.push([k]);
    return out;
  }
  function applyPaths(from, to, paths) {
    for (const p of paths) {
      if (p[0] === 'have+') { to.have = [...new Set([...(to.have || []), p[1]])]; continue; }
      if (p[0] === 'have-') { to.have = (to.have || []).filter(k => k !== p[1]); continue; }
      if (p.length === 1) { to[p[0]] = JSON.parse(JSON.stringify(from[p[0]] === undefined ? null : from[p[0]])); continue; }
      to[p[0]] = to[p[0]] || {}; const v = (from[p[0]] || {})[p[1]];
      if (v === undefined || v === null) { if (p[0] === 'days') to[p[0]][p[1]] = null; else delete to[p[0]][p[1]]; }
      else to[p[0]][p[1]] = JSON.parse(JSON.stringify(v));
    }
  }
  // etag + the last synced copy survive a reload, so an offline edit still merges after reopening the app.
  const SYNC_KEY = 'hmp.synced.v1';
  try { const sv = JSON.parse(localStorage.getItem(SYNC_KEY) || 'null'); if (sv && sv.family === family) { etag = sv.etag; lastSynced = sv.plan; } } catch (e) { /* ignore */ }
  function markSynced(copy) { lastSynced = copy; try { localStorage.setItem(SYNC_KEY, JSON.stringify({ family, etag, plan: copy })); } catch (e) { /* ignore */ } }
  // Fold the database's copy under this phone's own unsent changes. The base for the next diff is theirs, not the result.
  function mergeIn(theirs) {
    const mine = lastSynced ? changedPaths(lastSynced, plan) : [];
    const merged = normalize(JSON.parse(JSON.stringify(theirs)));
    if (!lastSynced) {
      if (!plan.syncedOnce) { adopt(theirs); render(); return true; }          // this phone never synced: the database wins
      if ((plan.updatedAt || 0) > (theirs.updatedAt || 0)) return false;      // nothing to compare against: keep ours
    }
    applyPaths(plan, merged, mine);
    merged.updatedAt = Math.max(Date.now(), (theirs.updatedAt || 0) + 1, (plan.updatedAt || 0) + 1);
    for (const k of Object.keys(plan)) delete plan[k]; Object.assign(plan, merged);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(plan)); } catch (e) { /* ignore */ }
    markSynced(normalize(JSON.parse(JSON.stringify(theirs))));
    render(); if (mine.length) toast('Merged with the other phone');
    return true;
  }
  function setSync(state) { syncState = state; const el = $('syncDot'); if (!el) return; el.className = 'sync ' + state; el.title = { ok: 'Synced', saving: 'Saving', offline: 'Offline, will retry', idle: '' }[state] || ''; }
  function queuePush() { dirty = true; clearTimeout(pushTimer); pushTimer = setTimeout(() => { pushTimer = null; push(); }, 400); }
  async function push() {
    if (!dirty || inFlight) return;
    inFlight = true; dirty = false; setSync('saving');
    try {
      if (!etag) {
        // No conflict token (fresh load, or came back after being offline): look before writing.
        const g = await fetch(remoteUrl('plan'), { cache: 'no-store', headers: { 'X-Firebase-ETag': 'true' } });
        if (!g.ok) throw new Error(g.status);
        etag = g.headers.get('ETag');
        const remote = await g.json();
        if (remote && (!lastSynced || remote.updatedAt !== lastSynced.updatedAt)) mergeIn(remote);
      }
      const bodyText = JSON.stringify(plan), sentAt = plan.updatedAt;
      const r = await fetch(remoteUrl('plan'), { method: 'PUT', body: bodyText, headers: { 'X-Firebase-ETag': 'true', 'If-Match': etag } });
      if (r.status === 412) {
        // Someone else wrote first. Start from theirs, lay this phone's own changes back on top, send again.
        etag = r.headers.get('ETag');
        const theirs = await r.json().catch(() => null);
        if (theirs) mergeIn(theirs);
        dirty = true;
      } else if (!r.ok) { throw new Error(r.status); }
      else { etag = r.headers.get('ETag'); markSynced(JSON.parse(bodyText)); }
      if (plan.updatedAt !== sentAt && r.status !== 412) dirty = true;   // edited again while the save was in flight
      setSync(dirty ? 'saving' : 'ok');
    } catch (e) { dirty = true; setSync('offline'); }
    inFlight = false;
    if (dirty && !pushTimer) queuePush();
  }
  // Swap the plan's contents without changing the object, so open drawers keep working.
  function adopt(remote) { for (const k of Object.keys(plan)) delete plan[k]; Object.assign(plan, normalize(remote)); markSynced(snapshot()); try { localStorage.setItem(STORE_KEY, JSON.stringify(plan)); } catch (e) { /* ignore */ } }
  async function pull(first) {
    if (!first && (dirty || inFlight)) return;   // never read over the top of an unsent edit (boot is the exception)
    try {
      const r = await fetch(remoteUrl('plan'), { cache: 'no-store', headers: etag ? { 'X-Firebase-ETag': 'true', 'If-None-Match': etag } : { 'X-Firebase-ETag': 'true' } });
      if (r.status === 304) { if (!dirty && !inFlight) setSync('ok'); return; }
      if (!r.ok) throw new Error(r.status);
      const remote = await r.json();
      if (!first && (dirty || inFlight)) return;   // the user tapped something while we waited
      etag = r.headers.get('ETag');
      if (remote && ((remote.updatedAt || 0) > (plan.updatedAt || 0) || (first && !plan.syncedOnce))) {
        // Anything this phone changed but never managed to send (an edit right before a reload, say) rides along.
        const unsent = lastSynced && plan.syncedOnce ? changedPaths(lastSynced, plan) : [];
        if (unsent.length) { mergeIn(remote); dirty = true; queuePush(); }
        else { adopt(remote); plan.syncedOnce = true; dirty = false; clearTimeout(pushTimer); pushTimer = null; render(); if (!first) toast('Updated from the other phone'); }
      } else if (!remote || (plan.updatedAt || 0) > (remote.updatedAt || 0)) {
        dirty = true; push();   // this phone is newer (or the database is empty): send ours up
      } else { markSynced(snapshot()); }
      if (!dirty) setSync('ok');
    } catch (e) { setSync('offline'); }
    booted = true;
  }
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    if (dirty) { if (!pushTimer && !inFlight) push(); }   // a failed save retrying, never a mid-typing debounce
    else pull(false);
    flushWeekQueue();
  }, 4000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pull(false); });
  window.addEventListener('online', () => { if (dirty) push(); else pull(false); flushWeekQueue(); });

  // Past weeks live under families/<key>/weeks/<weekOf>. Saved on the phone first, sent up in the background.
  function archiveWeek() {
    const t = totals();
    const snap = { weekOf: plan.weekOf, days: structuredClone(plan.days), potluckTheme: plan.potluckTheme, budget: plan.budget, spent: plan.spent, groceries: Math.round(t.groceries * 100) / 100, out: t.out, savedAt: Date.now() };
    try { localStorage.setItem('hmp.week.' + plan.weekOf, JSON.stringify(snap)); localStorage.setItem('hmp.weekq.' + plan.weekOf, '1'); } catch (e) { /* ignore */ }
    flushWeekQueue();
  }
  let flushing = false;
  async function flushWeekQueue() {
    if (flushing) return; flushing = true;
    try {
      const keys = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('hmp.weekq.')) keys.push(k.slice(10)); }
      for (const weekOf of keys) {
        const snap = JSON.parse(localStorage.getItem('hmp.week.' + weekOf) || 'null'); if (!snap) { localStorage.removeItem('hmp.weekq.' + weekOf); continue; }
        // Don't overwrite a fuller archive of the same week saved from the other phone.
        const r0 = await fetch(remoteUrl('weeks/' + weekOf), { cache: 'no-store' });
        const existing = r0.ok ? await r0.json() : null;
        const count = w => w && w.days ? Object.values(w.days).filter(Boolean).length : 0;
        if (existing && count(existing) > count(snap)) { localStorage.removeItem('hmp.weekq.' + weekOf); continue; }
        const r = await fetch(remoteUrl('weeks/' + weekOf), { method: 'PUT', body: JSON.stringify(snap) });
        if (r.ok) localStorage.removeItem('hmp.weekq.' + weekOf);
      }
    } catch (e) { /* offline: try again on the next tick */ }
    flushing = false;
  }
  async function loadWeeks() {
    let weeks = {};
    try { const r = await fetch(remoteUrl('weeks'), { cache: 'no-store' }); if (r.ok) weeks = (await r.json()) || {}; } catch (e) { /* offline */ }
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('hmp.week.')) { const w = JSON.parse(localStorage.getItem(k)); if (!weeks[w.weekOf]) weeks[w.weekOf] = w; } } } catch (e) { /* ignore */ }
    return Object.values(weeks).filter(w => w && w.weekOf).sort((a, b) => b.weekOf.localeCompare(a.weekOf));
  }
  let ui = { weeklyOpen: false };
  try { ui = { ...ui, ...JSON.parse(localStorage.getItem(UI_KEY) || '{}') }; } catch (e) { /* ignore */ }
  const saveUi = () => { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (e) { /* ignore */ } };

  // ---------- helpers ----------
  const $ = id => document.getElementById(id);
  const money = n => '$' + (Math.round(n * 100) / 100).toFixed(2);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const price = key => (prices[key] && prices[key].price) || 0;
  const flagsFor = key => {
    const p = prices[key] || {};
    return { sale: !!(p.onSale || p.priceCut), coupon: !!p.coupon, couponLabel: p.couponType === 'combo' ? 'combo deal' : 'coupon' };
  };
  const pillsFor = keys => keys.reduce((a, k) => { const f = flagsFor(k); a.sale = a.sale || f.sale; if (f.coupon && !a.coupon) { a.coupon = true; a.couponLabel = f.couponLabel; } return a; }, {});
  const pillHtml = p => (p.edited ? '<span class="pill edited">edited</span>' : '') + (p.sale ? '<span class="pill sale">sale</span>' : '') + (p.coupon ? `<span class="pill coupon">${p.couponLabel}</span>` : '');
  // "½ pack", "1 pack", "1½ packs", "3 pieces" for things sold by weight
  function packText(qty, key) {
    const byWeight = pantry[key] && /Avg\./.test(pantry[key].size);
    if (byWeight) return `${qty} ${qty === 1 ? 'piece' : 'pieces'}`;
    const whole = Math.floor(qty + 1e-9), frac = Math.round((qty - whole) * 4) / 4;
    const fracTxt = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[frac] || (frac ? String(frac) : '');
    const n = (whole ? whole : '') + fracTxt;
    return `${n || '0'} ${qty > 1 ? 'packs' : 'pack'}`;
  }
  // The next week: the coming Sunday, or the Sunday after the current plan's week, whichever is later.
  function nextSunday() {
    const d = new Date(); d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
    const after = new Date(plan.weekOf + 'T12:00:00'); after.setDate(after.getDate() + 7);
    return (after > d ? after : d).toISOString().slice(0, 10);
  }

  // Items a day's dinner actually needs this week (after this-week-only edits).
  function dayItems(d) {
    if (!d || d.type !== 'meal') return [];
    const m = meals[d.mealId]; if (!m) return [];
    return m.items
      .filter(it => !(d.dropped || []).includes(it.key))
      .map(it => ({ key: it.key, qty: d.qty && d.qty[it.key] != null ? d.qty[it.key] : it.qty }));
  }
  const dayCost = d => d && d.type === 'out' ? Number(d.amount || 0) : dayItems(d).reduce((s, it) => s + it.qty * price(it.key), 0);

  // Shopping lines: combine across dinners, checklist and extras, round up to packages.
  // A manual package override only holds while the computed need it was based on stays the same.
  function shoppingLines() {
    const need = {};
    const add = (key, qty, src) => { if (!pantry[key]) return; if (!need[key]) need[key] = { key, qty: 0, from: new Set() }; need[key].qty += qty; need[key].from.add(src); };
    for (const day of DAYS) for (const it of dayItems(plan.days[day.id])) add(it.key, it.qty, day.name);
    for (const [key, qty] of Object.entries(plan.checklist)) if (qty > 0) add(key, qty, 'weekly');
    for (const [key, qty] of Object.entries(plan.extras)) if (qty > 0) add(key, qty, 'extra');
    return Object.values(need).map(n => {
      const base = Math.max(1, Math.ceil(n.qty - 1e-9));
      const ov = plan.packs[n.key];
      const packs = ov && ov.base === base ? ov.packs : base;
      const have = plan.have.includes(n.key);
      return { ...n, base, packs, have, each: price(n.key), total: have ? 0 : packs * price(n.key), from: [...n.from] };
    });
  }
  function totals() {
    const lines = shoppingLines();
    const groceries = lines.reduce((s, l) => s + l.total, 0);
    const out = DAYS.reduce((s, d) => s + (plan.days[d.id] && plan.days[d.id].type === 'out' ? Number(plan.days[d.id].amount || 0) : 0), 0);
    const weekly = Object.entries(plan.checklist).reduce((s, [k, q]) => s + q * price(k), 0);
    return { groceries, out, combined: groceries + out, lines, weekly };
  }

  // ---------- render ----------
  function render() { renderHeader(); renderWeek(); renderChecklist(); renderList(); renderDeals(); }

  function renderHeader() {
    const t = totals();
    const wk = new Date(plan.weekOf + 'T12:00:00');
    $('weekLabel').textContent = 'Week of ' + wk.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    $('budgetTotal').textContent = money(t.combined);
    $('budgetSplit').textContent = `${money(t.groceries)} groceries · ${money(t.out)} out`;
    $('btnBudget').textContent = 'of ' + money(plan.budget);
    const pct = plan.budget ? Math.min(100, (t.combined / plan.budget) * 100) : 0;
    const fill = $('budgetFill');
    fill.style.width = pct + '%';
    fill.className = 'budget-fill' + (t.combined > plan.budget ? ' over' : pct > 85 ? ' warn' : '');
  }

  function renderWeek() {
    const ol = $('week'); ol.innerHTML = '';
    for (const day of DAYS) {
      const d = plan.days[day.id];
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'day' + (d && d.type === 'out' ? ' is-out' : '');
      btn.dataset.day = day.id;
      let mealHtml, priceHtml;
      if (!d) {
        mealHtml = `<div class="day-meal empty">Pick dinner</div>`;
        priceHtml = `<div class="day-price">&nbsp;</div>`;
      } else if (d.type === 'out') {
        mealHtml = `<div class="day-meal">${esc(d.label || 'Eat out')}</div><div class="day-sub">Eating out</div>`;
        priceHtml = `<div class="day-price out">${money(d.amount || 0)}</div>`;
      } else {
        const m = meals[d.mealId];
        const p = pillsFor(dayItems(d).map(it => it.key));
        p.edited = (d.dropped && d.dropped.length) || (d.qty && Object.keys(d.qty).length);
        mealHtml = `<div class="day-meal">${esc(m ? m.name : d.mealId)}${pillHtml(p)}</div><div class="day-sub">${esc(m ? m.notes || '' : '')}</div>`;
        priceHtml = `<div class="day-price">${money(dayCost(d))}</div>`;
      }
      const themeLabel = day.id === 'sun' && plan.potluckTheme ? `${day.theme}: ${esc(plan.potluckTheme)}` : day.theme;
      btn.innerHTML = `<div><div class="day-name">${day.name}</div><div class="day-theme">${themeLabel}</div></div><div>${mealHtml}</div>${priceHtml}`;
      btn.addEventListener('click', () => swapMode ? pickSwap(day.id) : openDay(day.id));
      if (swapMode === day.id) btn.classList.add('selecting');
      li.appendChild(btn); ol.appendChild(li);
    }
  }

  function renderChecklist() {
    const t = totals();
    const count = Object.values(plan.checklist).filter(q => q > 0).length;
    $('weeklySummary').textContent = count ? `${count} item${count === 1 ? '' : 's'} · ${money(t.weekly)}` : 'nothing yet';
    $('weeklyToggle').setAttribute('aria-expanded', ui.weeklyOpen);
    $('weeklyChevron').textContent = ui.weeklyOpen ? '▾' : '▸';
    $('weeklyBody').classList.toggle('hidden', !ui.weeklyOpen);
    const wrap = $('checklist'); wrap.innerHTML = '';
    const groupOf = key => (checklistDoc.groups.find(g => g.items.includes(key)) || { name: pantry[key] ? pantry[key].section : 'Other' }).name;
    const groups = {};
    for (const [key, qty] of Object.entries(plan.checklist)) if (qty > 0 && pantry[key]) (groups[groupOf(key)] = groups[groupOf(key)] || []).push(key);
    const order = [...checklistDoc.groups.map(g => g.name), ...Object.keys(groups).filter(n => !checklistDoc.groups.some(g => g.name === n))];
    for (const name of order) {
      if (!groups[name]) continue;
      const box = document.createElement('div'); box.className = 'group';
      box.innerHTML = `<div class="group-name">${esc(name)}</div>`;
      for (const key of groups[name]) {
        const p = pantry[key], qty = plan.checklist[key];
        const row = document.createElement('div'); row.className = 'crow';
        row.innerHTML = `<div><div class="crow-name">${esc(p.name)}</div><div class="crow-sub">${esc(p.size)}</div></div>` +
          `<div class="crow-price">${money(price(key) * qty)}</div>` +
          `<div class="stepper"><button type="button" aria-label="less">−</button><span class="n">${qty}</span><button type="button" aria-label="more">+</button></div>`;
        const [minus, plus] = row.querySelectorAll('button');
        minus.addEventListener('click', () => { plan.checklist[key] = Math.max(0, qty - 1); save(); });   // at 0 the row goes away
        plus.addEventListener('click', () => { plan.checklist[key] = qty + 1; save(); });
        box.appendChild(row);
      }
      wrap.appendChild(box);
    }
    if (!count) wrap.innerHTML = '<div class="empty-bucket">Nothing on the weekly list yet. Add the things you buy every week: milk, eggs, bread, snacks, drinks.</div>';
  }
  function openAddWeekly() {
    const groupOf = key => (checklistDoc.groups.find(g => g.items.includes(key)) || { name: pantry[key].section }).name;
    const bySec = {};
    for (const key of Object.keys(pantry)) if (!(plan.checklist[key] > 0)) (bySec[groupOf(key)] = bySec[groupOf(key)] || []).push(key);
    let html = `<h3>Add to every week</h3><p class="hint">Tap to add one pack a week. Change the number on the list after.</p>`;
    const order = [...checklistDoc.groups.map(g => g.name), ...Object.keys(bySec).filter(n => !checklistDoc.groups.some(g => g.name === n))];
    for (const name of order) {
      if (!bySec[name]) continue;
      html += `<div class="bucket-title">${esc(name)}</div>` + bySec[name].map(key => `<button type="button" class="option" data-add="${esc(key)}"><div><div class="option-name">${esc(pantry[key].name)}</div><div class="option-sub">${esc(pantry[key].size)}</div></div><div class="option-price">${money(price(key))}</div></button>`).join('');
    }
    html += `<p class="hint">Don't see what you buy? Tell Claude the product and it gets pinned to the real H-E-B item.</p>`;
    openSheet(html);
    body.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => { plan.checklist[b.dataset.add] = 1; save(); closeSheet(); toast('Added'); }));
  }
  function renderList() {
    const t = totals();
    const wrap = $('list'); wrap.innerHTML = '';
    const bySec = {};
    for (const l of t.lines) { const s = pantry[l.key].section; (bySec[s] = bySec[s] || []).push(l); }
    const secs = [...sectionOrder.filter(s => bySec[s]), ...Object.keys(bySec).filter(s => !sectionOrder.includes(s))];
    let coupons = 0;
    for (const s of secs) {
      const box = document.createElement('div'); box.className = 'sec';
      const secTotal = bySec[s].reduce((a, l) => a + l.total, 0);
      box.innerHTML = `<div class="sec-name"><span>${esc(s)}</span><span>${money(secTotal)}</span></div>`;
      for (const l of bySec[s]) {
        const p = pantry[l.key], pr = prices[l.key] || {}, f = flagsFor(l.key);
        if (f.coupon) coupons++;
        const forTxt = l.from.filter(x => x !== 'weekly' && x !== 'extra').join(', ');
        const row = document.createElement('div'); row.className = 'li' + (l.have ? ' have' : '');
        row.innerHTML =
          `<input class="li-check" type="checkbox" ${l.have ? 'checked' : ''} aria-label="have it">` +
          `<div><div class="li-name">${esc(p.name)}${pillHtml(f)}</div>` +
          `<div class="li-sub">${esc(p.size)} · ${esc(pr.aisle || '')}${forTxt ? ' · for ' + esc(forTxt) : ''}${f.coupon ? '<br>' + esc(pr.coupon) : ''}</div></div>` +
          `<div class="li-right"><div class="li-price">${f.sale && pr.listPrice ? `<span class="was">${money(pr.listPrice * l.packs)}</span>` : ''}${money(l.packs * l.each)}</div>` +
          `<div class="li-qty"><button type="button" aria-label="fewer">−</button><span class="n">${l.packs}</span><button type="button" aria-label="more">+</button></div></div>`;
        row.querySelector('.li-check').addEventListener('change', e => {
          plan.have = e.target.checked ? [...new Set([...plan.have, l.key])] : plan.have.filter(k => k !== l.key); save();
        });
        const [minus, plus] = row.querySelectorAll('.li-qty button');
        minus.addEventListener('click', () => {
          if (l.packs > 1) return setPacks(l.key, l.packs - 1, l.base);
          if (plan.extras[l.key]) { plan.extras[l.key] = 0; save(); return; }   // an added extra: remove it
          plan.have = [...new Set([...plan.have, l.key])]; save();               // otherwise: you have it
        });
        plus.addEventListener('click', () => setPacks(l.key, l.packs + 1, l.base));
        box.appendChild(row);
      }
      wrap.appendChild(box);
    }
    if (!t.lines.length) wrap.innerHTML = '<div class="empty-bucket">Nothing on the list yet. Pick some dinners on the Plan tab.</div>';
    $('listMeta').textContent = `${t.lines.length} items · prices pulled ${pricesDoc.pulled} at ${pricesDoc.store.name}` + (coupons ? ` · ${coupons} coupon item${coupons > 1 ? 's' : ''} (HEB app or paper slip, not in the total)` : '');
    const spent = $('spentInput');
    if (document.activeElement !== spent) spent.value = plan.spent == null ? '' : plan.spent;
    $('spentDiff').textContent = plan.spent == null ? 'Enter the receipt total after the trip to see how close the estimate was.' :
      `Estimate ${money(t.groceries)} · actual ${money(plan.spent)} · ${plan.spent > t.groceries ? 'over by ' + money(plan.spent - t.groceries) : 'under by ' + money(t.groceries - plan.spent)}`;
  }
  function setPacks(key, n, base) { plan.packs[key] = { packs: n, base }; save(); }

  function renderDeals() {
    const wrap = $('deals'); wrap.innerHTML = '';
    const deals = Object.keys(pantry).map(key => ({ key, p: pantry[key], pr: prices[key] || {} }))
      .filter(d => d.pr.onSale || d.pr.priceCut)
      .map(d => ({ ...d, saved: (d.pr.listPrice || d.pr.price) - d.pr.price }))
      .sort((a, b) => b.saved - a.saved);
    const combos = Object.keys(pantry).filter(key => prices[key] && prices[key].coupon);
    $('dealsMeta').textContent = `From your pantry, pulled ${pricesDoc.pulled} at ${pricesDoc.store.name}. Sale and price cut ring up automatically. Tap one to use it.`;
    if (!deals.length) wrap.innerHTML = '<div class="empty-bucket">Nothing from the pantry is on sale this week.</div>';
    const box = document.createElement('div'); box.className = 'sec';
    for (const d of deals) {
      const used = DAYS.filter(day => dayItems(plan.days[day.id]).some(it => it.key === d.key)).map(day => day.name);
      const row = document.createElement('button'); row.type = 'button'; row.className = 'li li-tap';
      row.innerHTML = `<div></div><div><div class="li-name">${esc(d.p.name)}<span class="pill sale">${d.pr.onSale ? 'sale' : 'price cut'}</span></div>` +
        `<div class="li-sub">${esc(d.p.size)} · ${esc(d.pr.aisle || '')}${used.length ? ' · on the plan ' + used.join(', ') : ''}</div></div>` +
        `<div class="li-right"><div class="li-price"><span class="was">${money(d.pr.listPrice)}</span>${money(d.pr.price)}</div><div class="li-sub">save ${money(d.saved)}</div></div>`;
      row.addEventListener('click', () => openDeal(d.key));
      box.appendChild(row);
    }
    if (deals.length) wrap.appendChild(box);
    if (combos.length) {
      const cbox = document.createElement('div'); cbox.className = 'sec';
      cbox.innerHTML = '<div class="sec-name"><span>Coupons (HEB app or paper slip)</span></div>';
      for (const key of combos) {
        const pr = prices[key], p = pantry[key];
        const row = document.createElement('div'); row.className = 'li';
        row.innerHTML = `<div></div><div><div class="li-name">${esc(p.name)}<span class="pill coupon">${pr.couponType === 'combo' ? 'combo deal' : 'coupon'}</span></div><div class="li-sub">${esc(pr.coupon)}</div></div><div class="li-right"><div class="li-price">${money(pr.price)}</div></div>`;
        cbox.appendChild(row);
      }
      wrap.appendChild(cbox);
    }
  }

  // ---------- sheet ----------
  const sheet = $('sheet'), backdrop = $('backdrop'), body = $('sheetBody');
  let onClose = null;
  function openSheet(html, closeHook) { body.innerHTML = html; onClose = closeHook || null; sheet.classList.remove('hidden'); backdrop.classList.remove('hidden'); sheet.scrollTop = 0; }
  function closeSheet() { const h = onClose; onClose = null; if (h) h(); sheet.classList.add('hidden'); backdrop.classList.add('hidden'); }
  backdrop.addEventListener('click', closeSheet);
  $('sheetClose').addEventListener('click', closeSheet);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.classList.contains('hidden')) closeSheet(); });

  function mealOption(m, current) {
    const cost = m.items.reduce((s, it) => s + it.qty * price(it.key), 0);
    return `<button type="button" class="option${current ? ' current' : ''}" data-meal="${esc(m.id)}">` +
      `<div><div class="option-name">${esc(m.name)}${pillHtml(pillsFor(m.items.map(it => it.key)))}</div>` +
      `<div class="option-sub">${esc(m.kind === 'heat-and-add' ? 'Heat and add' : m.kind === 'repeat' ? 'Easy' : 'Recipe')} · ${m.items.length} items${current ? ' · chosen, tap to edit' : ''}</div></div>` +
      `<div class="option-price">${money(cost)}</div></button>`;
  }

  function openDay(dayId) {
    const day = DAYS.find(d => d.id === dayId); const d = plan.days[dayId];
    const currentMeal = d && d.type === 'meal' ? d.mealId : null;
    const all = Object.values(meals);
    const themed = all.filter(m => day.buckets.includes(m.theme));
    const wild = all.filter(m => !day.buckets.includes(m.theme));
    let html = `<h3>${day.name}: ${day.theme}</h3><p class="hint">${day.id === 'sun' ? 'Pick the dish to bring.' : 'Tap a dinner.'}</p>`;
    if (day.id === 'sun') html += `<div class="bucket-title">This week's theme from church</div><div class="amount-row"><input id="potluckTheme" class="label" type="text" placeholder="Mexican, soups, breakfast for dinner..." value="${esc(plan.potluckTheme || '')}"></div>`;
    if (currentMeal) html += `<div class="row-actions"><button type="button" class="btn" id="editMeal">Edit ingredients for this week</button></div>`;
    if (day.buckets.length) {
      html += `<div class="bucket-title">${day.buckets.map(b => THEME_NAMES[b]).join(' / ')}</div>`;
      html += themed.length ? themed.map(m => mealOption(m, m.id === currentMeal)).join('') : `<div class="empty-bucket">No ${day.theme.toLowerCase()} meals saved yet. Tell Claude what you cook on ${day.name} and it will add the cards.</div>`;
    }
    html += `<div class="bucket-title">Eat out</div><p class="hint">Saves as you type.</p>`;
    html += `<div class="amount-row"><input id="outLabel" class="label" type="text" placeholder="Where (optional)" value="${esc(d && d.type === 'out' ? d.label || '' : '')}"></div>`;
    html += `<div class="amount-row">$ <input id="outAmount" type="number" inputmode="decimal" min="0" step="1" placeholder="0" value="${esc(d && d.type === 'out' ? d.amount || '' : '')}"><button type="button" class="btn" id="setOut">Done</button></div>`;
    if (wild.length) html += `<div class="bucket-title">Wildcard</div>` + wild.map(m => mealOption(m, m.id === currentMeal)).join('');
    html += `<div class="row-actions"><button type="button" class="btn ghost" id="clearDay">Nothing planned</button></div>`;
    const saveOut = () => {
      const amount = Number(body.querySelector('#outAmount').value || 0), label = body.querySelector('#outLabel').value.trim();
      if (!amount && !label) return;
      plan.days[dayId] = { type: 'out', label: label || 'Eat out', amount }; persist(); renderHeader(); renderWeek(); renderList();
    };
    openSheet(html);
    const themeInput = body.querySelector('#potluckTheme');
    if (themeInput) themeInput.addEventListener('input', e => { plan.potluckTheme = e.target.value.trim(); persist(); renderWeek(); });
    body.querySelectorAll('[data-meal]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.meal;
      if (id === currentMeal) return openMealEditor(dayId);
      plan.days[dayId] = { type: 'meal', mealId: id, dropped: [], qty: {} }; save(); closeSheet();
    }));
    const edit = body.querySelector('#editMeal'); if (edit) edit.addEventListener('click', () => openMealEditor(dayId));
    body.querySelector('#outAmount').addEventListener('input', saveOut);
    body.querySelector('#outLabel').addEventListener('input', saveOut);
    body.querySelector('#setOut').addEventListener('click', () => { saveOut(); closeSheet(); });
    body.querySelector('#clearDay').addEventListener('click', () => { plan.days[dayId] = null; save(); closeSheet(); });
  }

  function openMealEditor(dayId) {
    const d = plan.days[dayId]; const m = meals[d.mealId];
    d.dropped = d.dropped || []; d.qty = d.qty || {};
    let html = `<h3>${esc(m.name)}</h3><p class="hint">This week only. Uncheck what you already have. The saved card doesn't change.</p>`;
    if (m.notes) html += `<div class="notes">${esc(m.notes)}</div>`;
    html += `<div class="group">` + m.items.map(it => {
      const p = pantry[it.key]; const dropped = d.dropped.includes(it.key); const q = d.qty[it.key] != null ? d.qty[it.key] : it.qty;
      return `<div class="ing${dropped ? ' dropped' : ''}" data-key="${esc(it.key)}" data-base="${it.qty}"><input class="ing-check" type="checkbox" ${dropped ? '' : 'checked'} aria-label="need it">` +
        `<div><div class="ing-name">${esc(p.name)}</div><div class="ing-sub">${esc(p.size)} · ${money(price(it.key))} each</div></div>` +
        `<div class="stepper small"><button type="button" aria-label="less" ${dropped ? 'disabled' : ''}>−</button><span class="n">${packText(q, it.key)}</span><button type="button" aria-label="more" ${dropped ? 'disabled' : ''}>+</button></div></div>`;
    }).join('') + `</div>`;
    html += `<div class="row-actions"><button type="button" class="btn" id="doneEdit">Done</button><button type="button" class="btn ghost" id="backEdit">Back to dinners</button><button type="button" class="btn ghost" id="resetEdit">Reset to saved card</button></div>`;
    openSheet(html);
    body.querySelectorAll('.ing').forEach(row => {
      const key = row.dataset.key, base = Number(row.dataset.base);
      const [minus, plus] = row.querySelectorAll('.stepper button');
      const step = base >= 1 ? 1 : base;   // whole packs step by 1, fractional cards step by their own size
      row.querySelector('.ing-check').addEventListener('change', e => {
        d.dropped = e.target.checked ? d.dropped.filter(k => k !== key) : [...new Set([...d.dropped, key])];
        row.classList.toggle('dropped', !e.target.checked); minus.disabled = plus.disabled = !e.target.checked; save();
      });
      const cur = () => d.qty[key] != null ? d.qty[key] : base;
      minus.addEventListener('click', () => { d.qty[key] = Math.max(step, Math.round((cur() - step) * 4) / 4); row.querySelector('.n').textContent = packText(d.qty[key], key); save(); });
      plus.addEventListener('click', () => { d.qty[key] = Math.round((cur() + step) * 4) / 4; row.querySelector('.n').textContent = packText(d.qty[key], key); save(); });
    });
    body.querySelector('#doneEdit').addEventListener('click', closeSheet);
    body.querySelector('#backEdit').addEventListener('click', () => openDay(dayId));
    body.querySelector('#resetEdit').addEventListener('click', () => { d.dropped = []; d.qty = {}; save(); openMealEditor(dayId); });
  }

  function openDeal(key) {
    const p = pantry[key], pr = prices[key] || {};
    const using = Object.values(meals).filter(m => m.items.some(it => it.key === key));
    let html = `<h3>${esc(p.name)}</h3><p class="hint">${esc(p.size)} · <span class="was">${money(pr.listPrice)}</span> ${money(pr.price)} · ${esc(pr.aisle || '')}</p>`;
    if (using.length) {
      html += `<div class="bucket-title">Dinners that use it</div>`;
      for (const m of using) {
        const days = DAYS.filter(day => day.buckets.includes(m.theme));
        html += `<div class="option static"><div><div class="option-name">${esc(m.name)}</div><div class="option-sub">Put it on</div>` +
          `<div class="row-actions tight">${(days.length ? days : DAYS.filter(x => x.buckets.length)).map(day => `<button type="button" class="btn ghost small" data-put="${day.id}" data-meal="${esc(m.id)}">${day.name}</button>`).join('')}</div></div></div>`;
      }
    } else {
      html += `<div class="empty-bucket">No saved dinner uses this yet.</div>`;
    }
    html += `<div class="bucket-title">Or just stock up</div><div class="row-actions"><button type="button" class="btn" id="addExtra">Add 1 pack to the list</button></div>`;
    openSheet(html);
    body.querySelectorAll('[data-put]').forEach(b => b.addEventListener('click', () => {
      plan.days[b.dataset.put] = { type: 'meal', mealId: b.dataset.meal, dropped: [], qty: {} }; save(); closeSheet(); toast(`${meals[b.dataset.meal].name} on ${DAYS.find(x => x.id === b.dataset.put).name}`);
    }));
    body.querySelector('#addExtra').addEventListener('click', () => { plan.extras[key] = (plan.extras[key] || 0) + 1; plan.have = plan.have.filter(k => k !== key); save(); closeSheet(); toast('Added to the list'); });
  }

  // Swap days: tap the button, then two days.
  let swapMode = null; // null | 'pick' | dayId
  $('btnSwap').addEventListener('click', () => {
    swapMode = swapMode ? null : 'pick';
    $('btnSwap').textContent = swapMode ? 'Cancel swap' : 'Swap days';
    if (swapMode) toast('Tap the two days to swap');
    renderWeek();
  });
  function pickSwap(dayId) {
    if (swapMode === 'pick') { swapMode = dayId; renderWeek(); return; }
    const a = swapMode, b = dayId;
    [plan.days[a], plan.days[b]] = [plan.days[b], plan.days[a]];
    swapMode = null; $('btnSwap').textContent = 'Swap days'; save(); toast(a === b ? 'Same day, nothing swapped' : 'Swapped');
  }

  // Weekly section toggle
  $('weeklyToggle').addEventListener('click', () => { ui.weeklyOpen = !ui.weeklyOpen; saveUi(); renderChecklist(); });
  $('btnAddWeekly').addEventListener('click', openAddWeekly);

  // Budget target
  $('btnBudget').addEventListener('click', () => {
    openSheet(`<h3>Budget target</h3><p class="hint">Groceries plus eating out, for the whole week.</p>` +
      `<div class="amount-row">$ <input id="budgetInput" type="number" inputmode="decimal" min="0" step="5" value="${plan.budget}"><button type="button" class="btn" id="saveBudget">Save</button></div>`);
    body.querySelector('#saveBudget').addEventListener('click', () => { plan.budget = Number(body.querySelector('#budgetInput').value || 0); save(); closeSheet(); });
  });

  // New week: two taps, never one.
  $('btnNewWeek').addEventListener('click', () => {
    const nxt = new Date(nextSunday() + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    openSheet(`<h3>Start a new week?</h3><p class="hint">Clears the dinners, have-its and spent box. Keeps your budget and the Every week list. The new week starts Sunday ${nxt}.</p>` +
      `<div class="row-actions"><button type="button" class="btn danger" id="confirmNew">Yes, clear the week</button><button type="button" class="btn ghost" id="cancelNew">Keep it</button></div>`);
    body.querySelector('#cancelNew').addEventListener('click', closeSheet);
    body.querySelector('#confirmNew').addEventListener('click', () => {
      archiveWeek();
      plan.weekOf = nextSunday();
      for (const day of DAYS) plan.days[day.id] = null;
      plan.have = []; plan.packs = {}; plan.extras = {}; plan.spent = null; plan.potluckTheme = ''; save(); closeSheet(); toast('New week');
    });
  });

  // Share: the whole plan rides in the link. Works phone to phone with no account.
  function planText() {
    const t = totals();
    const lines = [`Dinner, week of ${plan.weekOf}`];
    for (const day of DAYS) {
      const d = plan.days[day.id];
      lines.push(`${day.name}: ${!d ? 'nothing yet' : d.type === 'out' ? `${d.label} (${money(d.amount)})` : (meals[d.mealId] || {}).name || d.mealId}`);
    }
    lines.push('', `Groceries about ${money(t.groceries)}, eating out ${money(t.out)}, budget ${money(plan.budget)}`);
    return lines.join('\n');
  }
  const shareUrl = () => location.origin + location.pathname + '?f=' + family;
  $('btnShare').addEventListener('click', async () => {
    const url = shareUrl(), text = planText();
    if (navigator.share) {
      try { await navigator.share({ title: 'Dinner this week', text, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    copy(text + '\n\nOpen the plan: ' + url, 'Link copied. Text it to the other phone; it stays in sync after that.');
  });

  // Past weeks: look back, or copy a week's dinners into this one.
  $('btnPast').addEventListener('click', async () => {
    openSheet(`<h3>Past weeks</h3><p class="hint">Loading…</p>`);
    const weeks = await loadWeeks();
    if (!weeks.length) { body.innerHTML = `<h3>Past weeks</h3><div class="empty-bucket">Nothing yet. Weeks land here when you tap Start a new week.</div>`; return; }
    let html = `<h3>Past weeks</h3><p class="hint">Tap a week to copy its dinners into this week.</p>`;
    for (const w of weeks) {
      const wk = new Date(w.weekOf + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const dinners = DAYS.map(day => { const d = w.days && w.days[day.id]; return !d ? null : d.type === 'out' ? `${day.name} ${d.label}` : `${day.name} ${(meals[d.mealId] || {}).name || d.mealId}`; }).filter(Boolean);
      html += `<button type="button" class="option" data-week="${esc(w.weekOf)}"><div><div class="option-name">Week of ${wk}${w.potluckTheme ? ' · potluck: ' + esc(w.potluckTheme) : ''}</div>` +
        `<div class="option-sub">${esc(dinners.join(' · ') || 'nothing planned')}</div></div>` +
        `<div class="option-price">${money(w.groceries || 0)}${w.spent != null ? `<div class="li-sub">spent ${money(w.spent)}</div>` : ''}</div></button>`;
    }
    body.innerHTML = html;
    body.querySelectorAll('[data-week]').forEach(b => b.addEventListener('click', () => {
      const w = weeks.find(x => x.weekOf === b.dataset.week);
      const planned = DAYS.filter(day => plan.days[day.id]).length;
      const doCopy = () => { for (const day of DAYS) plan.days[day.id] = w.days && w.days[day.id] ? structuredClone(w.days[day.id]) : null; plan.potluckTheme = w.potluckTheme || ''; save(); closeSheet(); toast('Copied that week\'s dinners'); };
      if (!planned) return doCopy();
      body.innerHTML = `<h3>Replace this week's dinners?</h3><p class="hint">You already have ${planned} night${planned > 1 ? 's' : ''} planned. Copying replaces them with the week of ${esc(w.weekOf)}. Your have-its and list tweaks stay.</p><div class="row-actions"><button type="button" class="btn danger" id="copyYes">Replace</button><button type="button" class="btn ghost" id="copyNo">Keep mine</button></div>`;
      body.querySelector('#copyYes').addEventListener('click', doCopy);
      body.querySelector('#copyNo').addEventListener('click', closeSheet);
    }));
  });

  $('spentInput').addEventListener('change', e => { plan.spent = e.target.value === '' ? null : Number(e.target.value); save(); });

  // Tabs
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('hidden', v.id !== t.dataset.view));
    window.scrollTo(0, 0);
  }));

  // ---------- exports ----------
  function notesText() {
    const t = totals(); const bySec = {};
    for (const l of t.lines) if (!l.have) { const s = pantry[l.key].section; (bySec[s] = bySec[s] || []).push(l); }
    const secs = [...sectionOrder.filter(s => bySec[s]), ...Object.keys(bySec).filter(s => !sectionOrder.includes(s))];
    const out = [`HEB · week of ${plan.weekOf} · est. ${money(t.groceries)}`, ''];
    for (const s of secs) {
      out.push(s.toUpperCase());
      for (const l of bySec[s]) out.push(`• ${l.packs > 1 ? l.packs + '× ' : ''}${pantry[l.key].name} (${pantry[l.key].size})${flagsFor(l.key).coupon ? ' [coupon]' : ''}`);
      out.push('');
    }
    return out.join('\n').trim();
  }
  function remindersText() {
    const t = totals();
    const order = l => { const i = sectionOrder.indexOf(pantry[l.key].section); return i < 0 ? 99 : i; };
    return t.lines.filter(l => !l.have).sort((a, b) => order(a) - order(b))
      .map(l => `${l.packs > 1 ? l.packs + 'x ' : ''}${pantry[l.key].name} - ${(prices[l.key] || {}).aisle || pantry[l.key].section}${flagsFor(l.key).coupon ? ' (coupon)' : ''}`)
      .join('\n');
  }
  $('btnNotes').addEventListener('click', () => copy(notesText(), 'Copied. Paste into Notes.'));
  $('btnReminders').addEventListener('click', () => copy(remindersText(), 'Copied. Paste into a Reminders list.'));

  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast(msg); } catch (e2) { toast('Copy failed'); }
      ta.remove();
    }
  }
  let toastTimer;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 2200); }

  render();
  pull(true);
})();
