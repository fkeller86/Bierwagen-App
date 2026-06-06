const KEY = { drinks: 'bw_drinks_v1', current: 'bw_current_v1', history: 'bw_history_v1' };

const DEFAULT_NAMES = [
  'Bier','Cola Bier','Radler','Alsterwasser','Schuss','Malzbier',
  'Fanta','Sprite','Cola','Cola Zero','Wasser','Korn',
  'Mariacron','Mariacron Cola','Flimm','Brezel'
];

function uid() { return 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function load(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

let drinks = load(KEY.drinks, null);
if (!drinks || !Array.isArray(drinks) || drinks.length === 0) {
  drinks = DEFAULT_NAMES.map(name => ({ id: uid(), name, price: 2 }));
  save(KEY.drinks, drinks);
}
let current = load(KEY.current, {});
let history = load(KEY.history, []);

// ---------- View routing ----------
const VIEWS = ['order', 'summary', 'history', 'settings'];
const TITLES = { order: 'Bestellung', summary: 'Übersicht', history: 'Verlauf', settings: 'Einstellungen' };

function showView(name) {
  VIEWS.forEach(v => document.getElementById('view-' + v).classList.toggle('active', v === name));
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  document.getElementById('view-title').textContent = TITLES[name];
  if (name === 'order') renderOrder();
  if (name === 'summary') renderSummary();
  if (name === 'history') renderHistory();
  if (name === 'settings') renderSettings();
  window.scrollTo(0, 0);
  document.querySelector('main').scrollTop = 0;
}
document.querySelectorAll('.tab').forEach(b => {
  b.addEventListener('click', () => showView(b.dataset.view));
});

// ---------- Order view ----------
function totalBons() {
  let t = 0;
  for (const id in current) {
    const d = drinks.find(x => x.id === id);
    if (d) t += d.price * current[id];
  }
  return t;
}
function totalItems() {
  let t = 0; for (const id in current) t += current[id]; return t;
}

function renderOrder() {
  const grid = document.getElementById('drink-grid');
  grid.innerHTML = '';
  if (drinks.length === 0) {
    grid.innerHTML = '<p class="empty">Noch keine Getränke konfiguriert. Füge welche unter ⚙️ hinzu.</p>';
    updateTotal();
    return;
  }
  drinks.forEach(d => {
    const qty = current[d.id] || 0;
    const tile = document.createElement('div');
    tile.className = 'tile' + (qty > 0 ? ' has-qty' : '');
    tile.innerHTML = `
      <div>
        <div class="name">${escapeHtml(d.name)}</div>
        <div class="price">${d.price} Bons</div>
      </div>
      <div class="qty-row">
        <button class="minus" aria-label="weniger">−</button>
        <div class="qty">${qty}</div>
      </div>
    `;
    tile.addEventListener('click', (e) => {
      if (e.target.classList.contains('minus')) return;
      current[d.id] = (current[d.id] || 0) + 1;
      save(KEY.current, current);
      renderOrder();
    });
    tile.querySelector('.minus').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!current[d.id]) return;
      current[d.id] -= 1;
      if (current[d.id] <= 0) delete current[d.id];
      save(KEY.current, current);
      renderOrder();
    });
    grid.appendChild(tile);
  });
  updateTotal();
}

function updateTotal() {
  document.getElementById('total-bons').textContent = totalBons();
  document.getElementById('finish-btn').disabled = totalItems() === 0;
}

document.getElementById('finish-btn').addEventListener('click', () => {
  if (totalItems() === 0) return;
  showView('summary');
});

// ---------- Summary view ----------
function renderSummary() {
  const list = document.getElementById('summary-list');
  list.innerHTML = '';
  let total = 0;
  // Render in the drinks-list order, not insertion order
  drinks.forEach(d => {
    const qty = current[d.id];
    if (!qty) return;
    const sub = d.price * qty;
    total += sub;
    const row = document.createElement('div');
    row.className = 'summary-row';
    row.innerHTML = `
      <span class="qty-x">${qty}×</span>
      <span class="name">${escapeHtml(d.name)}</span>
      <span class="sub">${sub} Bons</span>
    `;
    list.appendChild(row);
  });
  if (list.children.length === 0) {
    list.innerHTML = '<p class="empty">Keine Getränke ausgewählt.</p>';
  }
  document.getElementById('summary-total').textContent = total;
}

document.getElementById('back-edit-btn').addEventListener('click', () => showView('order'));

document.getElementById('new-order-btn').addEventListener('click', () => {
  if (Object.keys(current).length > 0) {
    const items = [];
    drinks.forEach(d => {
      const qty = current[d.id];
      if (qty) items.push({ id: d.id, name: d.name, price: d.price, qty });
    });
    const total = items.reduce((s, it) => s + it.price * it.qty, 0);
    history.unshift({ ts: Date.now(), items, total });
    history = history.slice(0, 10);
    save(KEY.history, history);
  }
  current = {};
  save(KEY.current, current);
  showView('order');
});

// ---------- History view ----------
function renderHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '';
  if (history.length === 0) {
    list.innerHTML = '<p class="empty">Noch keine abgeschlossenen Bestellungen.</p>';
    return;
  }
  history.forEach(h => {
    const dt = new Date(h.ts);
    const time = dt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const date = dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    const itemCount = h.items.reduce((a, it) => a + it.qty, 0);
    const preview = h.items.slice(0, 3).map(it => `${it.qty}× ${it.name}`).join(', ')
      + (h.items.length > 3 ? ', …' : '');
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div style="flex:1; min-width:0;">
        <div class="meta">${date} ${time} · ${itemCount} ${itemCount === 1 ? 'Artikel' : 'Artikel'}</div>
        <div class="preview">${escapeHtml(preview)}</div>
      </div>
      <div class="htotal"><strong>${h.total}</strong><br><span class="unit">Bons</span></div>
    `;
    item.addEventListener('click', () => {
      const msg = totalItems() > 0
        ? 'Diese Bestellung erneut öffnen? Die aktuelle, unfertige Bestellung wird verworfen.'
        : 'Diese Bestellung erneut öffnen?';
      if (!confirm(msg)) return;
      current = {};
      h.items.forEach(it => {
        // Re-link by id, fall back to name match if the drink was renamed/replaced
        const d = drinks.find(x => x.id === it.id) || drinks.find(x => x.name === it.name);
        if (d) current[d.id] = (current[d.id] || 0) + it.qty;
      });
      save(KEY.current, current);
      showView('order');
    });
    list.appendChild(item);
  });
}

// ---------- Settings view ----------
function renderSettings() {
  const list = document.getElementById('drink-config-list');
  list.innerHTML = '';
  drinks.forEach((d, idx) => {
    const row = document.createElement('div');
    row.className = 'config-row';
    row.innerHTML = `
      <button class="reorder-btn up" aria-label="nach oben" ${idx === 0 ? 'disabled' : ''}>↑</button>
      <button class="reorder-btn down" aria-label="nach unten" ${idx === drinks.length - 1 ? 'disabled' : ''}>↓</button>
      <input type="text" class="d-name" value="${escapeHtml(d.name)}" autocapitalize="words" autocomplete="off">
      <input type="number" class="d-price" min="0" step="1" value="${d.price}" inputmode="numeric">
      <button class="del-btn" aria-label="löschen">🗑</button>
    `;
    row.querySelector('.up').addEventListener('click', () => {
      if (idx === 0) return;
      [drinks[idx - 1], drinks[idx]] = [drinks[idx], drinks[idx - 1]];
      save(KEY.drinks, drinks); renderSettings();
    });
    row.querySelector('.down').addEventListener('click', () => {
      if (idx === drinks.length - 1) return;
      [drinks[idx + 1], drinks[idx]] = [drinks[idx], drinks[idx + 1]];
      save(KEY.drinks, drinks); renderSettings();
    });
    row.querySelector('.d-name').addEventListener('change', e => {
      const v = e.target.value.trim();
      if (v) { drinks[idx].name = v; save(KEY.drinks, drinks); }
      else { e.target.value = drinks[idx].name; }
    });
    row.querySelector('.d-price').addEventListener('change', e => {
      const v = parseInt(e.target.value, 10);
      if (!isNaN(v) && v >= 0) { drinks[idx].price = v; save(KEY.drinks, drinks); }
      else { e.target.value = drinks[idx].price; }
    });
    row.querySelector('.del-btn').addEventListener('click', () => {
      if (!confirm(`„${drinks[idx].name}" wirklich löschen?`)) return;
      const removedId = drinks[idx].id;
      drinks.splice(idx, 1);
      delete current[removedId];
      save(KEY.drinks, drinks);
      save(KEY.current, current);
      renderSettings();
    });
    list.appendChild(row);
  });
}

document.getElementById('add-drink-btn').addEventListener('click', () => {
  const nameEl = document.getElementById('new-drink-name');
  const priceEl = document.getElementById('new-drink-price');
  const name = nameEl.value.trim();
  const price = parseInt(priceEl.value, 10);
  if (!name) { nameEl.focus(); return; }
  if (isNaN(price) || price < 0) { priceEl.focus(); return; }
  drinks.push({ id: uid(), name, price });
  save(KEY.drinks, drinks);
  nameEl.value = '';
  priceEl.value = '2';
  renderSettings();
  nameEl.focus();
});

document.getElementById('reset-history-btn').addEventListener('click', () => {
  if (!confirm('Verlauf wirklich löschen?')) return;
  history = [];
  save(KEY.history, history);
  renderSettings();
});

document.getElementById('reset-all-btn').addEventListener('click', () => {
  if (!confirm('Alle Daten zurücksetzen?\n\nGetränke werden auf die Standardliste gesetzt, aktuelle Bestellung und Verlauf werden gelöscht.')) return;
  localStorage.removeItem(KEY.drinks);
  localStorage.removeItem(KEY.current);
  localStorage.removeItem(KEY.history);
  location.reload();
});

// ---------- Service worker (offline) ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ---------- Init ----------
showView('order');
