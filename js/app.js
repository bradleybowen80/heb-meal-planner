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

  // ---------- data ----------
  const [pantryDoc, mealsDoc, pricesDoc, checklistDoc, planSeed] = await Promise.all(
    ['pantry', 'meals', 'prices', 'checklist', 'plan'].map(n => fetch(`data/${n}.json`, { cache: "no-cache" }).then(r => r.json()))
  );
  const pantry = Object.fromEntries(pantryDoc.items.map(i => [i.key, i]));
  const prices = pricesDoc.prices;
  const meals = Object.fromEntries(mealsDoc.meals.map(m => [m.id, m]));
  const sectionOrder = pantryDoc.sectionOrder;

  let plan = loadPlan();
  function loadPlan() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (saved && saved.weekOf >= planSeed.weekOf) return saved;
    } catch (e) { /* fall through */ }
    return structuredClone(planSeed);
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(plan)); } catch (e) { /* private mode */ }
    render();
  }
  if (!plan.checklist || !Object.keys(plan.checklist).length) plan.checklist = { ...checklistDoc.defaults };
  plan.have = plan.have || [];

  // ---------- helpers ----------
  const $ = id => document.getElementById(id);
  const money = n => '$' + (Math.round(n * 100) / 100).toFixed(2);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const price = key => (prices[key] && prices[key].price) || 0;
  const flagsFor = key => {
    const p = prices[key] || {};
    return { sale: p.onSale || p.priceCut, coupon: !!p.coupon, couponLabel: p.couponType === 'combo' ? 'combo deal' : 'coupon' };
  };

  // Items a day's dinner actually needs this week (after this-week-only edits).
  function dayItems(d) {
    if (!d || d.type !== 'meal') return [];
    const m = meals[d.mealId]; if (!m) return [];
    return m.items
      .filter(it => !(d.dropped || []).includes(it.key))
      .map(it => ({ key: it.key, qty: d.qty && d.qty[it.key] != null ? d.qty[it.key] : it.qty }));
  }
  // Proportional cost of a dinner (what the ingredients used are worth).
  const dayCost = d => d && d.type === 'out' ? Number(d.amount || 0) : dayItems(d).reduce((s, it) => s + it.qty * price(it.key), 0);

  // Shopping lines: combine across dinners + checklist, round up to packages.
  function shoppingLines() {
    const need = {};
    const add = (key, qty, src) => { if (!need[key]) need[key] = { key, qty: 0, from: new Set() }; need[key].qty += qty; need[key].from.add(src); };
    for (const day of DAYS) for (const it of dayItems(plan.days[day.id])) add(it.key, it.qty, day.name);
    for (const [key, qty] of Object.entries(plan.checklist)) if (qty > 0) add(key, qty, 'weekly');
    return Object.values(need).map(n => {
      const packs = plan.packs && plan.packs[n.key] != null ? plan.packs[n.key] : Math.ceil(n.qty - 1e-9);
      const have = plan.have.includes(n.key);
      return { ...n, packs, have, each: price(n.key), total: have ? 0 : packs * price(n.key), from: [...n.from] };
    });
  }
  function totals() {
    const lines = shoppingLines();
    const groceries = lines.reduce((s, l) => s + l.total, 0);
    const out = DAYS.reduce((s, d) => s + (plan.days[d.id] && plan.days[d.id].type === 'out' ? Number(plan.days[d.id].amount || 0) : 0), 0);
    return { groceries, out, combined: groceries + out, lines };
  }

  // ---------- render ----------
  function render() { renderHeader(); renderWeek(); renderChecklist(); renderList(); renderDeals(); }

  function renderHeader() {
    const t = totals();
    const wk = new Date(plan.weekOf + 'T12:00:00');
    $('weekLabel').textContent = 'Week of ' + wk.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    $('budgetTotal').textContent = money(t.combined);
    $('budgetSplit').textContent = `${money(t.groceries)} groceries + ${money(t.out)} eating out`;
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
        mealHtml = `<div class="day-meal">${esc(d.label || 'Eat out')}</div><div class="day-sub">Tap to change the amount</div>`;
        priceHtml = `<div class="day-price out">${money(d.amount || 0)}</div>`;
      } else {
        const m = meals[d.mealId];
        const edited = (d.dropped && d.dropped.length) || (d.qty && Object.keys(d.qty).length);
        const pills = dayItems(d).reduce((a, it) => { const f = flagsFor(it.key); a.sale = a.sale || f.sale; if (f.coupon && !a.coupon) { a.coupon = true; a.couponLabel = f.couponLabel; } return a; }, {});
        mealHtml = `<div class="day-meal">${esc(m ? m.name : d.mealId)}${edited ? '<span class="pill edited">edited</span>' : ''}${pills.sale ? '<span class="pill sale">sale</span>' : ''}${pills.coupon ? `<span class="pill coupon">${pills.couponLabel}</span>` : ''}</div>` +
          `<div class="day-sub">${esc(m ? m.notes || '' : '')}</div>`;
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
    const wrap = $('checklist'); wrap.innerHTML = '';
    for (const g of checklistDoc.groups) {
      const box = document.createElement('div'); box.className = 'group';
      box.innerHTML = `<div class="group-name">${esc(g.name)}</div>`;
      for (const key of g.items) {
        const p = pantry[key]; if (!p) continue;
        const qty = plan.checklist[key] || 0;
        const row = document.createElement('div'); row.className = 'crow' + (qty ? '' : ' zero');
        row.innerHTML = `<div><div class="crow-name">${esc(p.name)}</div><div class="crow-sub">${esc(p.size)}</div></div>` +
          `<div class="crow-price">${money(price(key) * qty)}</div>` +
          `<div class="stepper"><button type="button" aria-label="less">−</button><span class="n">${qty}</span><button type="button" aria-label="more">+</button></div>`;
        const [minus, plus] = row.querySelectorAll('button');
        minus.addEventListener('click', () => { plan.checklist[key] = Math.max(0, qty - 1); save(); });
        plus.addEventListener('click', () => { plan.checklist[key] = qty + 1; save(); });
        box.appendChild(row);
      }
      wrap.appendChild(box);
    }
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
        const row = document.createElement('div'); row.className = 'li' + (l.have ? ' have' : '');
        row.innerHTML =
          `<input class="li-check" type="checkbox" ${l.have ? 'checked' : ''} aria-label="have it">` +
          `<div><div class="li-name">${esc(p.name)}${f.sale ? '<span class="pill sale">sale</span>' : ''}${f.coupon ? `<span class="pill coupon">${f.couponLabel}</span>` : ''}</div>` +
          `<div class="li-sub">${esc(p.size)} · ${esc(pr.aisle || '')}${f.coupon ? '<br>' + esc(pr.coupon) : ''}</div></div>` +
          `<div class="li-right"><div class="li-price">${f.sale && pr.listPrice ? `<span class="was">${money(pr.listPrice * l.packs)}</span>` : ''}${money(l.packs * l.each)}</div>` +
          `<div class="li-qty"><button type="button" aria-label="fewer">−</button><span class="n">${l.packs}</span><button type="button" aria-label="more">+</button></div></div>`;
        row.querySelector('.li-check').addEventListener('change', e => {
          plan.have = e.target.checked ? [...new Set([...plan.have, l.key])] : plan.have.filter(k => k !== l.key); save();
        });
        const [minus, plus] = row.querySelectorAll('.li-qty button');
        minus.addEventListener('click', () => setPacks(l.key, Math.max(0, l.packs - 1)));
        plus.addEventListener('click', () => setPacks(l.key, l.packs + 1));
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
  function renderDeals() {
    const wrap = $('deals'); wrap.innerHTML = '';
    const deals = Object.keys(pantry).map(key => ({ key, p: pantry[key], pr: prices[key] || {} }))
      .filter(d => d.pr.onSale || d.pr.priceCut)
      .map(d => ({ ...d, saved: (d.pr.listPrice || d.pr.price) - d.pr.price }))
      .sort((a, b) => b.saved - a.saved);
    const combos = Object.keys(pantry).filter(key => prices[key] && prices[key].coupon);
    $('dealsMeta').textContent = `From your pantry, pulled ${pricesDoc.pulled} at ${pricesDoc.store.name}. Sale and price cut ring up automatically.`;
    if (!deals.length) { wrap.innerHTML = '<div class="empty-bucket">Nothing from the pantry is on sale this week.</div>'; }
    const box = document.createElement('div'); box.className = 'sec';
    for (const d of deals) {
      const used = DAYS.filter(day => dayItems(plan.days[day.id]).some(it => it.key === d.key)).map(day => day.name);
      const row = document.createElement('div'); row.className = 'li';
      row.innerHTML = `<div></div><div><div class="li-name">${esc(d.p.name)}<span class="pill sale">${d.pr.onSale ? 'sale' : 'price cut'}</span></div>` +
        `<div class="li-sub">${esc(d.p.size)} · ${esc(d.pr.aisle || '')}${used.length ? ' · on the plan ' + used.join(', ') : ''}</div></div>` +
        `<div class="li-right"><div class="li-price"><span class="was">${money(d.pr.listPrice)}</span>${money(d.pr.price)}</div><div class="li-sub">save ${money(d.saved)}</div></div>`;
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
  function setPacks(key, n) { plan.packs = plan.packs || {}; plan.packs[key] = n; save(); }

  // ---------- sheet ----------
  const sheet = $('sheet'), backdrop = $('backdrop'), body = $('sheetBody');
  function openSheet(html) { body.innerHTML = html; sheet.classList.remove('hidden'); backdrop.classList.remove('hidden'); sheet.scrollTop = 0; }
  function closeSheet() { sheet.classList.add('hidden'); backdrop.classList.add('hidden'); }
  backdrop.addEventListener('click', closeSheet);
  $('sheetClose').addEventListener('click', closeSheet);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

  function mealOption(m, current) {
    const cost = m.items.reduce((s, it) => s + it.qty * price(it.key), 0);
    const pills = m.items.reduce((a, it) => { const f = flagsFor(it.key); a.sale = a.sale || f.sale; if (f.coupon && !a.coupon) { a.coupon = true; a.couponLabel = f.couponLabel; } return a; }, {});
    return `<button type="button" class="option${current ? ' current' : ''}" data-meal="${esc(m.id)}">` +
      `<div><div class="option-name">${esc(m.name)}${pills.sale ? '<span class="pill sale">sale</span>' : ''}${pills.coupon ? `<span class="pill coupon">${pills.couponLabel}</span>` : ''}</div>` +
      `<div class="option-sub">${esc(m.kind === 'heat-and-add' ? 'Heat and add' : m.kind === 'repeat' ? 'Easy' : 'Recipe')} · ${m.items.length} items</div></div>` +
      `<div class="option-price">${money(cost)}</div></button>`;
  }

  function openDay(dayId) {
    const day = DAYS.find(d => d.id === dayId); const d = plan.days[dayId];
    const currentMeal = d && d.type === 'meal' ? d.mealId : null;
    const all = Object.values(meals);
    const themed = all.filter(m => day.buckets.includes(m.theme));
    const wild = all.filter(m => !day.buckets.includes(m.theme));
    let html = `<h3>${day.name}: ${day.theme}</h3><p class="hint">${day.id === 'sun' ? 'Pick the dish to bring. Tap the chosen one again to edit it for this week.' : 'Tap a dinner. Tap the chosen one again to edit it for this week.'}</p>`;
    if (day.id === 'sun') html += `<div class="bucket-title">This week's theme from church</div><div class="amount-row"><input id="potluckTheme" class="label" type="text" placeholder="Mexican, soups, breakfast for dinner..." value="${esc(plan.potluckTheme || '')}"></div>`;
    if (currentMeal) html += `<div class="row-actions"><button type="button" class="btn" id="editMeal">Edit this week's ingredients</button></div>`;
    if (day.buckets.length) {
      html += `<div class="bucket-title">${day.buckets.map(b => THEME_NAMES[b]).join(' / ')}</div>`;
      html += themed.length ? themed.map(m => mealOption(m, m.id === currentMeal)).join('') : `<div class="empty-bucket">No ${day.theme.toLowerCase()} meals saved yet. Tell Claude what you cook on ${day.name} and it will add the cards.</div>`;
    }
    html += `<div class="bucket-title">Eat out</div>`;
    html += `<div class="amount-row"><input id="outLabel" class="label" type="text" placeholder="Where (optional)" value="${esc(d && d.type === 'out' ? d.label || '' : '')}"></div>`;
    html += `<div class="amount-row">$ <input id="outAmount" type="number" inputmode="decimal" min="0" step="1" placeholder="0" value="${esc(d && d.type === 'out' ? d.amount || '' : '')}"><button type="button" class="btn" id="setOut">Eat out</button></div>`;
    if (wild.length) html += `<div class="bucket-title">Wildcard</div>` + wild.map(m => mealOption(m, m.id === currentMeal)).join('');
    html += `<div class="row-actions"><button type="button" class="btn ghost" id="clearDay">Nothing planned</button></div>`;
    openSheet(html);
    const themeInput = body.querySelector('#potluckTheme');
    if (themeInput) themeInput.addEventListener('change', e => { plan.potluckTheme = e.target.value.trim(); save(); });
    body.querySelectorAll('[data-meal]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.meal;
      if (id === currentMeal) return openMealEditor(dayId);
      plan.days[dayId] = { type: 'meal', mealId: id, dropped: [], qty: {} }; save(); closeSheet();
    }));
    const edit = body.querySelector('#editMeal'); if (edit) edit.addEventListener('click', () => openMealEditor(dayId));
    body.querySelector('#setOut').addEventListener('click', () => {
      plan.days[dayId] = { type: 'out', label: body.querySelector('#outLabel').value.trim() || 'Eat out', amount: Number(body.querySelector('#outAmount').value || 0) }; save(); closeSheet();
    });
    body.querySelector('#clearDay').addEventListener('click', () => { plan.days[dayId] = null; save(); closeSheet(); });
  }

  function openMealEditor(dayId) {
    const d = plan.days[dayId]; const m = meals[d.mealId];
    d.dropped = d.dropped || []; d.qty = d.qty || {};
    let html = `<h3>${esc(m.name)}</h3><p class="hint">This week only. Uncheck what you already have, or change amounts. The saved card doesn't change.</p>`;
    if (m.notes) html += `<div class="notes">${esc(m.notes)}</div>`;
    html += `<div class="group">` + m.items.map(it => {
      const p = pantry[it.key]; const dropped = d.dropped.includes(it.key); const q = d.qty[it.key] != null ? d.qty[it.key] : it.qty;
      return `<div class="ing${dropped ? ' dropped' : ''}" data-key="${esc(it.key)}"><input class="ing-check" type="checkbox" ${dropped ? '' : 'checked'}>` +
        `<div><div class="ing-name">${esc(p.name)}</div><div class="ing-sub">${esc(p.size)} · ${money(price(it.key))} each</div></div>` +
        `<div class="ing-qty"><input type="number" inputmode="decimal" min="0" step="0.25" value="${q}" ${dropped ? 'disabled' : ''}></div></div>`;
    }).join('') + `</div>`;
    html += `<div class="row-actions"><button type="button" class="btn" id="doneEdit">Done</button><button type="button" class="btn ghost" id="resetEdit">Reset to saved card</button></div>`;
    openSheet(html);
    body.querySelectorAll('.ing').forEach(row => {
      const key = row.dataset.key;
      row.querySelector('.ing-check').addEventListener('change', e => {
        d.dropped = e.target.checked ? d.dropped.filter(k => k !== key) : [...new Set([...d.dropped, key])];
        row.classList.toggle('dropped', !e.target.checked); row.querySelector('input[type=number]').disabled = !e.target.checked; save();
      });
      row.querySelector('input[type=number]').addEventListener('change', e => { d.qty[key] = Number(e.target.value || 0); save(); });
    });
    body.querySelector('#doneEdit').addEventListener('click', closeSheet);
    body.querySelector('#resetEdit').addEventListener('click', () => { d.dropped = []; d.qty = {}; save(); closeSheet(); });
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
    swapMode = null; $('btnSwap').textContent = 'Swap days'; save(); toast('Swapped');
  }

  // Budget target and week controls.
  $('btnBudget').addEventListener('click', () => {
    openSheet(`<h3>Budget target</h3><p class="hint">Groceries plus eating out, for the whole week.</p>` +
      `<div class="amount-row">$ <input id="budgetInput" type="number" inputmode="decimal" min="0" step="5" value="${plan.budget}"><button type="button" class="btn" id="saveBudget">Save</button></div>` +
      `<div class="bucket-title">This week</div><div class="row-actions"><button type="button" class="btn ghost" id="newWeek">Start a new week</button><button type="button" class="btn ghost" id="copyPlan">Copy plan as text</button></div>` +
      `<p class="hint">New week clears the dinners, have-its and spent box, and keeps the budget and weekly checklist.</p>`);
    body.querySelector('#saveBudget').addEventListener('click', () => { plan.budget = Number(body.querySelector('#budgetInput').value || 0); save(); closeSheet(); });
    body.querySelector('#newWeek').addEventListener('click', () => {
      const next = new Date(plan.weekOf + 'T12:00:00'); next.setDate(next.getDate() + 7);
      plan.weekOf = next.toISOString().slice(0, 10);
      for (const day of DAYS) plan.days[day.id] = null;
      plan.have = []; plan.packs = {}; plan.spent = null; plan.potluckTheme = ''; save(); closeSheet(); toast('New week');
    });
    body.querySelector('#copyPlan').addEventListener('click', () => copy(JSON.stringify(plan, null, 2), 'Plan copied'));
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
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 1800); }

  render();
})();
