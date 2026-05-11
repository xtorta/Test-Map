// ─── Map ──────────────────────────────────────────────────────────────────────
const map = L.map('map', { crs: L.CRS.Simple, minZoom: -8, tap: true, tapTolerance: 15 });
const bounds = [[0,0],[5120,3584]];
const s1=0.89, s2=0.89, b1=-1595, b2=1724, coordToMapScalar=0.89;
L.imageOverlay('cropped.webp', bounds).addTo(map);
map.fitBounds(bounds);
map.getContainer().addEventListener('contextmenu', e => e.preventDefault());
map.on('contextmenu', () => {});

// ─── Constants ────────────────────────────────────────────────────────────────
const isMobile = () => window.innerWidth < 768;
const SB_FULL    = () => isMobile() ? 290 : 310;
const SB_COMPACT = () => isMobile() ? 52  : 52;

const COLOURS = {
  'Misc':'#ffa958','Plants':'#ee74a3','Chests':'#c68a09','Orb chests':'#bb5b11',
  'Ores':'#8758d3','NPCs':'#27ad71','Haydn Seek':'#388e9f','Obelisks':'#6e1ac7',
  'Mobs':'#d13a3a','Sparkling mobs':'#eb19c8','Dungeons':'#430dd8',
  'Checkpoints':'#4db3db','Minibosses':'#eb681c','Critters':'#de58ff',
  'Recipes':'#9b7700','Secret orbs':'#a23030',
};
const ICONS = {
  'Obelisks':'./icons/mapMarker5.png','Chests':'./icons/mapMarker2.png',
  'Orb chests':'./icons/mapMarker11.png','NPCs':'./icons/mapMarker8.png',
  'Dungeons':'./icons/mapMarker3.png','Checkpoints':'./icons/mapMarker6.png',
  'Minibosses':'./icons/mapMarker1.png',
};

// ─── State ────────────────────────────────────────────────────────────────────
(function migrate() {
  const raw = localStorage.getItem('completedMarkers');
  if (!raw) return;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || !arr.length) return;
    if (!arr.every(id => /^.+__\d+$/.test(id))) localStorage.removeItem('completedMarkers');
  } catch { localStorage.removeItem('completedMarkers'); }
})();

const completedMarkers = new Set(JSON.parse(localStorage.getItem('completedMarkers') || '[]'));
let hideCompleted = false;
const allMarkers = [];
const categoryRegistry = {};

function saveCompleted() { localStorage.setItem('completedMarkers', JSON.stringify([...completedMarkers])); }
function getMarkerId(item, idx) { return `${item.label}__${idx}`; }
function getMarkerDomEl(marker) {
  const el = marker.getElement();
  if (!el) return null;
  return el.closest ? (el.closest('.leaflet-marker-icon') || el) : el;
}
function applyCompletedStyle(marker, done) {
  const d = getMarkerDomEl(marker); if (!d) return;
  if (done) {
    if (hideCompleted) d.style.display = 'none';
    else { d.style.display=''; d.style.opacity='0.4'; d.style.filter='grayscale(60%)'; }
  } else { d.style.display=''; d.style.opacity=''; d.style.filter=''; }
}
function toggleComplete(mid, marker) {
  completedMarkers.has(mid) ? completedMarkers.delete(mid) : completedMarkers.add(mid);
  saveCompleted();
  applyCompletedStyle(marker, completedMarkers.has(mid));
  updateCounts();
}

// ─── Load & init ──────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const r = await fetch('assets.json');
    if (!r.ok) throw new Error(r.status);
    initMap(await r.json());
  } catch(e) { console.error('Failed:', e); }
}

function initMap(data) {
  const layers = {};
  class iconMarker { constructor(f={}){const s=28;this.props={iconUrl:'./icons/mapMarker1.png',iconSize:[s,s],iconAnchor:[s/2,s/2],popupAnchor:[0,-s/2]};for(const[k,v]of Object.entries(f))this.props[k]=v;}}
  class cMarker    { constructor(f={}){this.props={radius:9,fillColor:'#ffa958',color:'#ffffff',weight:1.05,opacity:1,fillOpacity:1};for(const[k,v]of Object.entries(f))this.props[k]=v;}}
  class circleArea { constructor(f={}){this.props={radius:coordToMapScalar*50,fillColor:'#ffa958',color:'#ffffff',weight:1.05,opacity:1,fillOpacity:1};for(const[k,v]of Object.entries(f))this.props[k]=v;}}

  const stylingDict = {
    'Misc':new cMarker().props,'Plants':new cMarker({fillColor:'#ee74a3'}).props,
    'Chests':new cMarker({fillColor:'#c68a09',color:'#fffb00'}).props,
    'Orb chests':new cMarker({fillColor:'#bb5b11',color:'#fffb00'}).props,
    'Ores':new cMarker({fillColor:'#8758d3'}).props,'NPCs':new cMarker({fillColor:'#27ad71'}).props,
    'Haydn Seek':new cMarker({fillColor:'#388e9f'}).props,'Obelisks':new cMarker({fillColor:'#6e1ac7'}).props,
    'Mobs':new cMarker({fillColor:'#d13a3a',radius:8}).props,'Sparkling mobs':new cMarker({fillColor:'#eb19c8'}).props,
    'Dungeons':new cMarker({fillColor:'#430dd8'}).props,'Checkpoints':new cMarker({fillColor:'#4db3db'}).props,
    'Minibosses':new cMarker({fillColor:'#eb681c'}).props,'Critters':new cMarker({fillColor:'#de58ff'}).props,
    'Recipes':new cMarker({fillColor:'#9b7700'}).props,'Secret orbs':new cMarker({fillColor:'#a23030'}).props,
  };
  const iconDict = {
    'Obelisks':new iconMarker({iconUrl:'./icons/mapMarker5.png'}).props,
    'Chests':new iconMarker({iconUrl:'./icons/mapMarker2.png'}).props,
    'Orb chests':new iconMarker({iconUrl:'./icons/mapMarker11.png'}).props,
    'NPCs':new iconMarker({iconUrl:'./icons/mapMarker8.png'}).props,
    'Dungeons':new iconMarker({iconUrl:'./icons/mapMarker3.png'}).props,
    'Checkpoints':new iconMarker({iconUrl:'./icons/mapMarker6.png'}).props,
    'Minibosses':new iconMarker({iconUrl:'./icons/mapMarker1.png'}).props,
  };
  const circleDict = {
    'Recipes':new circleArea({fillColor:'#9b7700',radius:coordToMapScalar*40,opacity:0.5,fillOpacity:0.5}).props,
    'Secret orbs':new circleArea({fillColor:'#a23030',radius:coordToMapScalar*40,opacity:0.5,fillOpacity:0.5}).props,
    'Haydn Seek':new circleArea({fillColor:'#388e9f',radius:coordToMapScalar*70,opacity:0.5,fillOpacity:0.5}).props,
  };

  data.forEach((item, idx) => {
    const cat = item.categories?.[0] || 'Misc';
    if (!categoryRegistry[cat]) categoryRegistry[cat] = { total:0, markerIds:[] };
    categoryRegistry[cat].total++;
    categoryRegistry[cat].markerIds.push(getMarkerId(item, idx));
  });

  data.forEach((item, idx) => {
    const coords = [(s1*(4096-item.y)+b1), s2*(item.x+b2)];
    const cat = item.categories?.[0] || 'Misc';
    if (!layers[cat]) layers[cat] = L.layerGroup();
    let m;
    if (cat in iconDict)         m = L.marker(coords, {icon: L.icon(iconDict[cat])});
    else if (cat in circleDict)  m = L.circle(coords, circleDict[cat]);
    else if (cat in stylingDict) m = L.circleMarker(coords, stylingDict[cat]);
    else                         m = L.circleMarker(coords, new cMarker().props);
    const mid = getMarkerId(item, idx);
    allMarkers.push({ markerId:mid, marker:m, category:cat, label:item.label, coords });
    m.bindPopup(`<div style="text-align:center;font-family:Noto,sans-serif;">${item.label}</div>`);
    m.on('contextmenu', e => { L.DomEvent.preventDefault(e); L.DomEvent.stopPropagation(e); m.closePopup(); toggleComplete(mid, m); });
    m.on('add', () => setTimeout(() => applyCompletedStyle(m, completedMarkers.has(mid)), 0));
    m.addTo(layers[cat]);
  });

  buildSidebar(layers);
  loadChecked(layers);
  updateCounts();
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────
const SVG = {
  search: `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="6.5" cy="6.5" r="4"/><line x1="10" y1="10" x2="14" y2="14"/></svg>`,
  eye:    `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>`,
  eyeOff:`<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/><line x1="2" y1="2" x2="14" y2="14"/></svg>`,
  reset:  `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,4 1,1 4,1"/><path d="M1 1 A7 7 0 1 1 1 10"/></svg>`,
  compact:`<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="1" width="12" height="12" rx="1.5"/><line x1="5" y1="1" x2="5" y2="13"/></svg>`,
  full:   `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="1" width="12" height="12" rx="1.5"/><line x1="1" y1="5" x2="13" y2="5"/></svg>`,
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function buildSidebar(layers) {
  document.getElementById('sidebar')?.remove();
  document.getElementById('sb-toggle')?.remove();
  document.getElementById('sb-search-float')?.remove();

  const savedView  = localStorage.getItem('sbView') || 'full'; // 'full'|'compact'|'closed'
  const aboutOpen  = localStorage.getItem('sbAboutOpen') !== '0';

  // ── Shell ────────────────────────────────────────────────────────
  const sidebar = mk('div', {id:'sidebar'});
  if (savedView === 'compact') sidebar.classList.add('compact');

  // ── Header ───────────────────────────────────────────────────────
  const hdr = mk('div', {id:'sb-header'});
  const title = mk('span', {id:'sb-title'});
  title.textContent = 'Farever Map';

  const viewBtns = mk('div', {id:'sb-view-btns'});
  // Single toggle: shows compact icon when full, full icon when compact
  const btnToggleView = mk('button', {id:'sb-btn-toggle-view', class:'sb-view-btn'});
  const isCompact = () => sidebar.classList.contains('compact');
  const updateViewBtn = () => {
    btnToggleView.innerHTML = isCompact() ? SVG.full : SVG.compact;
    btnToggleView.setAttribute('data-tip', isCompact() ? 'Expand sidebar' : 'Compact sidebar');
  };
  updateViewBtn();
  viewBtns.appendChild(btnToggleView);

  hdr.appendChild(title);
  hdr.appendChild(viewBtns);
  sidebar.appendChild(hdr);
  sidebar.appendChild(sep());

  // ── About ────────────────────────────────────────────────────────
  const aboutRow = mk('div', {id:'sb-about-row', class:'full-only'});
  aboutRow.innerHTML = `<span>ℹ️ About</span><span id="sb-about-chevron">${aboutOpen?'▲':'▼'}</span>`;
  const aboutPanel = mk('div', {id:'sb-about-panel', class:'full-only'});
  aboutPanel.style.display = aboutOpen ? 'block' : 'none';
  aboutPanel.innerHTML = `Welcome to the Farever interactive map, built by the <a href="https://farever.wiki" target="_blank">Farever Wiki</a> team.<br><br>
    This map pulls data directly from the game. Use the filters to control what is shown. Some locations are slightly obscured to preserve exploration.<br><br>
    Feedback: <strong>@IceCaveBear</strong> on Discord.`;
  aboutRow.addEventListener('click', () => {
    const open = aboutPanel.style.display === 'block';
    aboutPanel.style.display = open ? 'none' : 'block';
    document.getElementById('sb-about-chevron').textContent = open ? '▼' : '▲';
    localStorage.setItem('sbAboutOpen', open ? '0' : '1');
  });
  sidebar.appendChild(aboutRow);
  sidebar.appendChild(aboutPanel);
  sidebar.appendChild(sep({id:'sb-sep-about'}));

  // ── Tools: search + hide + reset — one section, one separator each side ──
  // Full mode shows: search input row + hide/reset buttons
  // Compact mode shows: search icon + hide icon + reset icon (no extra separators between them)

  const searchRow = mk('div', {id:'sb-search-row', class:'full-only'});
  searchRow.innerHTML = `<input id="sb-search" type="text" placeholder="🔍 Search markers…" autocomplete="off"><button id="sb-search-clear" style="display:none">✕</button>`;
  sidebar.appendChild(searchRow);

  const iconTools = mk('div', {id:'sb-icon-tools'});
  const searchToolBtn = mkToolBtn('sb-search-tool', SVG.search, 'Search');
  searchToolBtn.classList.add('compact-only');
  const hideBtn   = mkToolBtn('sb-hide-btn',   SVG.eye,   'Hide Completed');
  const resetBtn  = mkToolBtn('sb-reset-btn',  SVG.reset, 'Reset Completed');
  iconTools.appendChild(searchToolBtn);
  iconTools.appendChild(hideBtn);
  iconTools.appendChild(resetBtn);
  sidebar.appendChild(iconTools);
  sidebar.appendChild(sep());

  // ── Category list ─────────────────────────────────────────────────
  const catList = mk('div', {id:'sb-cat-list'});
  Object.keys(layers).forEach(name => {
    const colour  = COLOURS[name] || '#ffa958';
    const iconUrl = ICONS[name];
    const total   = categoryRegistry[name]?.total || 0;
    const row = mk('label', {class:'sb-cat-row'});
    row.setAttribute('data-tip', name);
    const indicator = iconUrl
      ? `<img src="${iconUrl}" class="sb-cat-icon" alt="">`
      : `<span class="sb-cat-dot" style="background:${colour}"></span>`;
    row.innerHTML = `
      <input type="checkbox" data-layer="${name}" class="category" style="display:none">
      <span class="sb-check-img"></span>
      ${indicator}
      <span class="sb-cat-name" style="color:${colour}">${name}</span>
      <span class="sb-cat-count" data-cat="${name}">0/${total}</span>`;
    catList.appendChild(row);
  });
  sidebar.appendChild(catList);
  sidebar.appendChild(sep({id:'sb-sep-hint'}));

  // ── Hint bar ──────────────────────────────────────────────────────
  const hint = mk('div', {id:'sb-hint'});
  hint.innerHTML = `<span class="sb-hint-icon">🖱️</span><span class="sb-hint-text"><strong>Right-click</strong> any marker to mark it complete</span>`;
  sidebar.appendChild(hint);

  document.body.appendChild(sidebar);

  // ── Toggle arrow ──────────────────────────────────────────────────
  const toggle = mk('button', {id:'sb-toggle'});
  document.body.appendChild(toggle);

  // ── Sidebar state management ──────────────────────────────────────
  let sidebarOpen = savedView !== 'closed';

  function curW() {
    return sidebar.classList.contains('compact') ? SB_COMPACT() : SB_FULL();
  }

  function applyLayout(animate) {
    if (!animate) { sidebar.style.transition = 'none'; toggle.style.transition = 'none'; document.getElementById('map').style.transition = 'none'; }
    const w = curW();
    sidebar.style.transform = sidebarOpen ? '' : `translateX(${w}px)`;
    toggle.style.right      = sidebarOpen ? w + 'px' : '0';
    toggle.innerHTML        = sidebarOpen ? '▶' : '◀';
    document.getElementById('map').style.right = (sidebarOpen && !isMobile()) ? w + 'px' : '0';
    // Floating search: show when closed
    const fs = document.getElementById('sb-search-float');
    if (fs) fs.style.display = sidebarOpen ? 'none' : 'flex';
    if (!animate) requestAnimationFrame(() => {
      sidebar.style.transition = ''; toggle.style.transition = '';
      document.getElementById('map').style.transition = '';
    });
    setTimeout(() => map.invalidateSize(), 270);
  }

  function saveView() {
    const v = !sidebarOpen ? 'closed' : sidebar.classList.contains('compact') ? 'compact' : 'full';
    localStorage.setItem('sbView', v);
  }

  // Toggle open/close
  toggle.addEventListener('click', () => {
    sidebarOpen = !sidebarOpen;
    saveView();
    applyLayout(true);
    if (!sidebarOpen) {
      // Only show floating search in compact mode (not plain closed on mobile)
      if (sidebar.classList.contains('compact')) buildFloatingSearch(layers, toggle);
    } else {
      document.getElementById('sb-search-float')?.remove();
    }
  });

  // View toggle (compact ↔ full)
  btnToggleView.addEventListener('click', () => {
    if (isCompact()) {
      sidebar.classList.remove('compact');
      searchToolBtn.style.display = 'none';
    } else {
      sidebar.classList.add('compact');
      searchToolBtn.style.display = '';
    }
    updateViewBtn();
    saveView(); applyLayout(true);
  });

  applyLayout(false);
  window.addEventListener('resize', () => applyLayout(false));

  // Search tool button (compact mode) — pops out floating search to the left
  searchToolBtn.style.display = isCompact() ? '' : 'none';
  searchToolBtn.addEventListener('click', () => {
    buildFloatingSearch(layers, searchToolBtn);
  });

  // Keep compact-only visibility in sync with view toggle (handled above in btnToggleView)

  // ── Checkboxes ────────────────────────────────────────────────────
  document.querySelectorAll('#sb-cat-list input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', e => {
      const n = e.target.dataset.layer;
      e.target.checked ? map.addLayer(layers[n]) : map.removeLayer(layers[n]);
      updateLocalStorage();
    });
  });

  // ── Search ────────────────────────────────────────────────────────
  wireSearch(
    document.getElementById('sb-search'),
    document.getElementById('sb-search-clear'),
    document.getElementById('sb-search-row'),
    layers
  );

  // ── Hide completed ────────────────────────────────────────────────
  hideBtn.addEventListener('click', () => {
    hideCompleted = !hideCompleted;
    document.querySelector('#sb-hide-btn .sb-tool-label').textContent = hideCompleted ? 'Show Completed' : 'Hide Completed';
    hideBtn.classList.toggle('active', hideCompleted);
    hideBtn.innerHTML = hideCompleted
      ? `${SVG.eyeOff}<span class="sb-tool-label">Show Completed</span>`
      : `${SVG.eye}<span class="sb-tool-label">Hide Completed</span>`;
    hideBtn.setAttribute('data-tip', hideCompleted ? 'Show Completed' : 'Hide Completed');
    allMarkers.forEach(({markerId, marker}) => applyCompletedStyle(marker, completedMarkers.has(markerId)));
  });

  // ── Reset completed ───────────────────────────────────────────────
  resetBtn.addEventListener('click', () => {
    if (!completedMarkers.size) return;
    if (!confirm(`Reset all ${completedMarkers.size} completed marker(s)?`)) return;
    completedMarkers.clear(); saveCompleted();
    allMarkers.forEach(({marker}) => {
      const d = getMarkerDomEl(marker); if (!d) return;
      d.style.opacity=''; d.style.filter=''; d.style.display='';
    });
    updateCounts();
  });
}

// ─── Floating search ──────────────────────────────────────────────────────────
function buildFloatingSearch(layers, anchorEl) {
  // Toggle: if already open, close it
  const existing = document.getElementById('sb-search-float');
  if (existing) { existing.remove(); return; }

  const wrap = mk('div', {id:'sb-search-float'});

  const inputWrap = mk('div', {id:'sb-float-input-wrap'});
  const input = mk('input');
  Object.assign(input, {type:'text', placeholder:'Search markers…', id:'sb-float-input', autocomplete:'off'});
  const closeBtn = mk('button', {id:'sb-float-close'});
  closeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>`;
  closeBtn.title = 'Close search';
  inputWrap.appendChild(input);
  inputWrap.appendChild(closeBtn);
  wrap.appendChild(inputWrap);

  // Position: fixed, right-aligned to left edge of sidebar, vertically near anchor
  const sidebarEl = document.getElementById('sidebar');
  const sbRect = sidebarEl ? sidebarEl.getBoundingClientRect() : null;
  const anchorRect = anchorEl ? anchorEl.getBoundingClientRect() : null;
  wrap.style.position = 'fixed';
  wrap.style.right = sbRect ? (window.innerWidth - sbRect.left + 8) + 'px' : '320px';
  wrap.style.top   = anchorRect ? anchorRect.top + 'px' : '50%';
  wrap.style.zIndex = '1200';
  wrap.style.display = 'flex';

  document.body.appendChild(wrap);
  setTimeout(() => input.focus(), 50);

  closeBtn.addEventListener('click', () => {
    clearSearch(layers, {}); // reset all filters to saved state
    allMarkers.forEach(({markerId, marker}) => {
      const d = getMarkerDomEl(marker); if (!d) return;
      d.style.outline = '';
      applyCompletedStyle(marker, completedMarkers.has(markerId));
    });
    // Restore checkboxes to saved state
    const saved = JSON.parse(localStorage.getItem('checkedBoxes')) || [];
    document.querySelectorAll('#sb-cat-list input[type="checkbox"]').forEach(cb => {
      const n = cb.dataset.layer;
      if (saved.includes(n)) { cb.checked=true; map.addLayer(layers[n]); }
      else { cb.checked=false; map.removeLayer(layers[n]); }
    });
    wrap.remove();
  });

  wireSearch(input, null, inputWrap, layers);
}

// ─── Shared search wiring ─────────────────────────────────────────────────────
function wireSearch(input, clearBtn, container, layers) {
  let searchActive = false, savedVis = {}, resultsBox = null;

  function removeResults() { resultsBox?.remove(); resultsBox = null; }

  function doSearch(q) {
    removeResults();
    if (!q) { clearSearch(layers, savedVis); searchActive = false; return; }
    if (!searchActive) {
      document.querySelectorAll('#sb-cat-list input[type="checkbox"]').forEach(cb => savedVis[cb.dataset.layer] = cb.checked);
      searchActive = true;
    }
    Object.keys(layers).forEach(n => map.addLayer(layers[n]));
    const matches = allMarkers.filter(({label}) => label.toLowerCase().includes(q));
    allMarkers.forEach(({label, marker}) => {
      const d = getMarkerDomEl(marker); if (!d) return;
      const hit = label.toLowerCase().includes(q);
      d.style.display = hit ? '' : 'none';
      d.style.outline = hit ? '2px solid #f39c12' : '';
    });
    if (!matches.length) return;
    resultsBox = mk('div', {id: container.id === 'sb-search-row' ? 'sb-search-results' : 'sb-float-results'});
    matches.slice(0, 10).forEach(({label, coords, category}) => {
      const item = mk('div', {class:'sb-result-item'});
      item.innerHTML = `<span class="sb-result-dot" style="background:${COLOURS[category]||'#ffa958'}"></span><span>${label}</span>`;
      item.addEventListener('click', () => {
        map.flyTo(coords, 0, {animate:true, duration:0.8});
        removeResults();
        input.value = label;
        if (clearBtn) clearBtn.style.display = '';
      });
      resultsBox.appendChild(item);
    });
    container.appendChild(resultsBox);
  }

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (clearBtn) clearBtn.style.display = q ? '' : 'none';
    doSearch(q);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { input.value=''; if(clearBtn) clearBtn.style.display='none'; clearSearch(layers, savedVis); searchActive=false; removeResults(); }
  });
  if (clearBtn) clearBtn.addEventListener('click', () => { input.value=''; clearBtn.style.display='none'; clearSearch(layers, savedVis); searchActive=false; removeResults(); });
}

// ─── Counts ───────────────────────────────────────────────────────────────────
function updateCounts() {
  Object.keys(categoryRegistry).forEach(cat => {
    const reg  = categoryRegistry[cat];
    const done = reg.markerIds.filter(id => completedMarkers.has(id)).length;
    const el   = document.querySelector(`.sb-cat-count[data-cat="${cat}"]`);
    if (!el) return;
    el.textContent   = `${done}/${reg.total}`;
    el.style.color   = done===reg.total&&reg.total>0 ? '#27ae60' : done>0 ? '#e67e22' : '#777';
    el.style.fontWeight = done > 0 ? 'bold' : 'normal';
  });
  // No global total displayed — removed
}

// ─── localStorage ─────────────────────────────────────────────────────────────
function updateLocalStorage() {
  const checked = [];
  document.querySelectorAll('#sb-cat-list input[type="checkbox"]').forEach(cb => { if(cb.checked) checked.push(cb.dataset.layer); });
  localStorage.setItem('checkedBoxes', JSON.stringify(checked));
}
function loadChecked(layers) {
  const saved = JSON.parse(localStorage.getItem('checkedBoxes')) || [];
  document.querySelectorAll('#sb-cat-list input[type="checkbox"]').forEach(input => {
    const n = input.dataset.layer;
    if (saved.includes(n)) { input.checked=true; map.addLayer(layers[n]); }
    else { input.checked=false; map.removeLayer(layers[n]); }
  });
}
function clearSearch(layers, savedVis) {
  document.querySelectorAll('#sb-cat-list input[type="checkbox"]').forEach(cb => {
    const n = cb.dataset.layer;
    const was = savedVis[n] !== undefined ? savedVis[n] : cb.checked;
    was ? map.addLayer(layers[n]) : map.removeLayer(layers[n]);
  });
  allMarkers.forEach(({markerId, marker}) => {
    const d = getMarkerDomEl(marker); if (!d) return;
    d.style.outline = '';
    applyCompletedStyle(marker, completedMarkers.has(markerId));
  });
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function mk(tag, attrs={}) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => k==='class' ? (e.className=v) : e.setAttribute(k,v));
  return e;
}
function sep(attrs={}) {
  const s = mk('span', attrs); s.classList.add('sb-sep'); return s;
}
function mkViewBtn(id, svg, tip, active) {
  const b = mk('button', {id:`sb-btn-${id}`, class:'sb-view-btn' + (active ? ' active' : '')});
  b.setAttribute('data-tip', tip);
  b.innerHTML = svg;
  return b;
}
function mkToolBtn(id, svg, tip) {
  const b = mk('button', {id, class:'sb-tool-btn'});
  b.setAttribute('data-tip', tip);
  b.innerHTML = `${svg}<span class="sb-tool-label">${tip}</span>`;
  return b;
}

loadData();
