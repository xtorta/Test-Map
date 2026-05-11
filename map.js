const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -8,
  tap: true,
  tapTolerance: 15
});
const bounds = [[0,0],[5120,3584]];
let coordToMapScalar=0.89, s1=0.89, s2=0.89, b1=-1595, b2=1724;
L.imageOverlay('cropped.webp', bounds).addTo(map);
map.fitBounds(bounds);
// Suppress both native and Leaflet contextmenu so right-click on markers doesn't interfere with UI
map.getContainer().addEventListener('contextmenu', e => e.preventDefault());
map.on('contextmenu', () => {});

// --- State ---
// Clear any old-format completedMarkers (label__x__y or label-only) 
// since IDs are now label__index and old ones can't be reliably mapped
(function migrateCompletedMarkers() {
  const raw = localStorage.getItem('completedMarkers');
  if (!raw) return;
  try {
    const old = JSON.parse(raw);
    if (!Array.isArray(old) || old.length === 0) return;
    // Old format: had coordinates (multiple __ segments with numbers) or label-only
    // New format: label__number (index). If any entry doesn't match label__digits, clear all.
    const newFormat = /^.+__\d+$/;
    if (!old.every(id => newFormat.test(id))) {
      localStorage.removeItem('completedMarkers');
    }
  } catch(e) { localStorage.removeItem('completedMarkers'); }
})();

const completedMarkers = new Set(JSON.parse(localStorage.getItem('completedMarkers')||'[]'));
let hideCompleted = false;
const _savedLayout = localStorage.getItem('layoutMode');
const _mobileDefault = window.innerWidth < 768 ? 'top' : 'sidebar';
let layoutMode = _savedLayout || _mobileDefault;
const SIDEBAR_W = 310;
const SB = 'rgb(215,210,200)';
const allMarkers = [];
const categoryRegistry = {};

function saveCompleted() {
  localStorage.setItem('completedMarkers', JSON.stringify([...completedMarkers]));
}
function getMarkerId(item, index) { return `${item.label}__${index}`; }
function getMarkerDomEl(marker) {
  const el = marker.getElement();
  if (!el) return null;
  return el.closest ? (el.closest('.leaflet-marker-icon') || el) : el;
}
function applyCompletedStyle(marker, done) {
  const d = getMarkerDomEl(marker);
  if (!d) return;
  if (done) {
    if (hideCompleted) { d.style.display='none'; }
    else { d.style.display=''; d.style.opacity='0.4'; d.style.filter='grayscale(60%)'; }
  } else { d.style.display=''; d.style.opacity=''; d.style.filter=''; }
}

function updateSidebarCounts() {
  let totalDone=0;
  Object.keys(categoryRegistry).forEach(cat=>{
    const reg=categoryRegistry[cat];
    const done=reg.markerIds.filter(id=>completedMarkers.has(id)).length;
    totalDone+=done;
    const el=document.querySelector(`.sidebar-count[data-cat="${cat}"]`);
    if(!el) return;
    el.textContent=`${done}/${reg.total}`;
    el.style.color=done===reg.total&&reg.total>0?'#27ae60':done>0?'#e67e22':'#555';
    el.style.fontWeight=done>0?'bold':'normal';
  });
  const t=document.getElementById('sidebar-total');
  if(t){
    t.textContent=`${totalDone}/${allMarkers.length}`;
    t.style.color=totalDone===allMarkers.length&&allMarkers.length>0?'#4caf50':totalDone>0?'#f39c12':'rgba(255,255,255,0.75)';
  }
}
function updateTopMenuCounts() {
  Object.keys(categoryRegistry).forEach(cat=>{
    const reg=categoryRegistry[cat];
    const done=reg.markerIds.filter(id=>completedMarkers.has(id)).length;
    const el=document.querySelector(`.top-count[data-cat="${cat}"]`);
    if(!el) return;
    el.textContent=done>0?`${done}/${reg.total}`:`(${reg.total})`;
    el.style.color=done===reg.total&&reg.total>0?'#27ae60':done>0?'#e67e22':'';
  });
}
function updateCounts() { layoutMode==='sidebar'?updateSidebarCounts():updateTopMenuCounts(); }

function toggleComplete(markerId, marker) {
  completedMarkers.has(markerId)?completedMarkers.delete(markerId):completedMarkers.add(markerId);
  saveCompleted();
  applyCompletedStyle(marker, completedMarkers.has(markerId));
  updateCounts();
}

async function loadData() {
  try {
    const r = await fetch('assets.json');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    initMap(await r.json());
  } catch (e) {
    console.error('Failed to load assets.json:', e);
  }
}

function initMap(data) {
  const layers={};
  class iconMarker{constructor(f={}){const s=28;this.props={iconUrl:'./icons/mapMarker1.png',iconSize:[s,s],iconAnchor:[s/2,s/2],popupAnchor:[0,-s/2]};for(const[k,v]of Object.entries(f))this.props[k]=v;}}
  class cMarker{constructor(f={}){this.props={radius:9,fillColor:"#ffa958",color:"#ffffff",weight:1.05,opacity:1,fillOpacity:1};for(const[k,v]of Object.entries(f))this.props[k]=v;}}
  class circleArea{constructor(f={}){this.props={radius:coordToMapScalar*50,fillColor:"#ffa958",color:"#ffffff",weight:1.05,opacity:1,fillOpacity:1};for(const[k,v]of Object.entries(f))this.props[k]=v;}}

  const stylingDict={
    'Misc':new cMarker().props,'Plants':new cMarker({fillColor:"#ee74a3"}).props,
    'Chests':new cMarker({fillColor:"#c68a09",color:"#fffb00"}).props,
    'Orb chests':new cMarker({fillColor:"#bb5b11",color:"#fffb00"}).props,
    'Ores':new cMarker({fillColor:"#8758d3"}).props,'NPCs':new cMarker({fillColor:"#27ad71"}).props,
    'Haydn Seek':new cMarker({fillColor:"#00d2d9"}).props,'Obelisks':new cMarker({fillColor:"rgb(110,26,199)"}).props,
    'Mobs':new cMarker({fillColor:"#d13a3a",radius:8}).props,'Sparkling mobs':new cMarker({fillColor:"#eb19c8"}).props,
    'Dungeons':new cMarker({fillColor:"#430dd8"}).props,'Checkpoints':new cMarker({fillColor:"#4db3db"}).props,
    'Minibosses':new cMarker({fillColor:"#eb681c"}).props,'Critters':new cMarker({fillColor:"#de58ff"}).props,
    'Recipes':new cMarker({fillColor:"#9b7700"}).props,'Secret orbs':new cMarker({fillColor:"#a23030"}).props,
  };
  const iconDict={
    'Obelisks':new iconMarker({iconUrl:'./icons/mapMarker5.png'}).props,
    'Chests':new iconMarker({iconUrl:'./icons/mapMarker2.png'}).props,
    'Orb chests':new iconMarker({iconUrl:'./icons/mapMarker11.png'}).props,
    'NPCs':new iconMarker({iconUrl:'./icons/mapMarker8.png'}).props,
    'Dungeons':new iconMarker({iconUrl:'./icons/mapMarker3.png'}).props,
    'Checkpoints':new iconMarker({iconUrl:'./icons/mapMarker6.png'}).props,
    'Minibosses':new iconMarker({iconUrl:'./icons/mapMarker1.png'}).props,
  };
  const circleDict={
    'Recipes':new circleArea({fillColor:"#9b7700",radius:coordToMapScalar*40,opacity:0.5,fillOpacity:0.5}).props,
    'Secret orbs':new circleArea({fillColor:"#a23030",radius:coordToMapScalar*40,opacity:0.5,fillOpacity:0.5}).props,
    'Haydn Seek':new circleArea({fillColor:"#00d2d9",radius:coordToMapScalar*70,opacity:0.5,fillOpacity:0.5}).props,
  };

  data.forEach((item, idx)=>{
    const cat=item.categories?.[0]||'Misc';
    if(!categoryRegistry[cat])categoryRegistry[cat]={total:0,markerIds:[]};
    categoryRegistry[cat].total++;
    categoryRegistry[cat].markerIds.push(getMarkerId(item, idx));
  });
  data.forEach((item, idx)=>{
    const coords=[(s1*(4096-item.y)+b1),s2*(item.x+b2)];
    const category=item.categories?.[0]||'Misc';
    if(!layers[category])layers[category]=L.layerGroup();
    let m;
    if(category in iconDict)        m=L.marker(coords,{icon:L.icon(iconDict[category])});
    else if(category in circleDict)  m=L.circle(coords,circleDict[category]);
    else if(category in stylingDict) m=L.circleMarker(coords,stylingDict[category]);
    else                             m=L.circleMarker(coords,new cMarker().props);
    const mid=getMarkerId(item, idx);
    allMarkers.push({markerId:mid,marker:m,category,label:item.label});
    m.bindPopup(`<div style="text-align:center;">${item.label}</div>`);
    m.on('contextmenu',e=>{L.DomEvent.preventDefault(e);L.DomEvent.stopPropagation(e);m.closePopup();toggleComplete(mid,m);});
    m.on('add',()=>setTimeout(()=>applyCompletedStyle(m,completedMarkers.has(mid)),0));
    m.addTo(layers[category]);
  });

  if(layoutMode==='sidebar') buildSidebar(layers);
  else buildTopMenu(layers);

  buildHintBubble();
  loadChecked(layers);
  updateCounts();
}

// =========================================
// HINT BUBBLE — fixed bottom-left
// =========================================
function buildHintBubble() {
  // Remove any existing
  document.getElementById('hint-bubble')?.remove();

  const minimised = localStorage.getItem('hintMinimised') === '1';

  const bubble = document.createElement('div');
  bubble.id = 'hint-bubble';

  // Expanded panel
  const panel = document.createElement('div');
  panel.id = 'hint-panel';
  if (minimised) panel.classList.add('hidden');
  panel.innerHTML = `
    <span class="hint-icon">🖱️</span>
    <span class="hint-body"><strong>Right-click</strong> any marker to mark it complete</span>
    <button id="hint-minimise-btn" title="Minimise">−</button>`;
  bubble.appendChild(panel);

  // Collapsed icon button
  const iconBtn = document.createElement('button');
  iconBtn.id = 'hint-icon-btn';
  iconBtn.title = 'Show hint';
  iconBtn.innerHTML = '🖱️';
  if (minimised) iconBtn.classList.add('visible');
  bubble.appendChild(iconBtn);

  document.body.appendChild(bubble);

  // Minimise
  document.getElementById('hint-minimise-btn').addEventListener('click', () => {
    panel.classList.add('hidden');
    iconBtn.classList.add('visible');
    localStorage.setItem('hintMinimised', '1');
  });

  // Restore
  iconBtn.addEventListener('click', () => {
    panel.classList.remove('hidden');
    iconBtn.classList.remove('visible');
    localStorage.setItem('hintMinimised', '0');
  });
}

// =========================================
// SIDEBAR LAYOUT
// =========================================
function buildSidebar(layers) {
  document.body.classList.remove('top-menu-mode');
  document.querySelectorAll('.text--area,.legend').forEach(el=>el.style.display='none');
  document.getElementById('top-ui')?.remove();
  document.documentElement.style.removeProperty('--top-ui-h');
  document.getElementById('sidebar')?.remove();
  document.getElementById('sidebar-toggle')?.remove();

  const sidebar=document.createElement('div');
  sidebar.id='sidebar';
  sidebar.style.cssText=`position:fixed;top:0;right:0;width:${SIDEBAR_W}px;height:100vh;
    background:${SB};border-left:2px solid #a09880;z-index:1000;
    display:flex;flex-direction:column;font-family:Noto,sans-serif;
    box-shadow:-4px 0 20px rgba(0,0,0,0.18);transition:transform 0.25s ease;`;

  // Header
  const hdr=document.createElement('div');
  hdr.style.cssText=`padding:0.8em 1em;background:rgb(120,90,55);
    display:flex;align-items:center;justify-content:space-between;flex-shrink:0;`;
  hdr.innerHTML=`
    <span style="font-weight:bold;color:white;font-size:1em;letter-spacing:0.04em;">📍 Farever Map</span>
    <span id="sidebar-total" style="font-size:0.85em;font-weight:bold;color:rgba(255,255,255,0.75);">0/0</span>`;
  sidebar.appendChild(hdr);

  // About
  sidebar.appendChild(sep());
  const infoRow=document.createElement('div');
  infoRow.style.cssText=`display:flex;align-items:center;justify-content:space-between;
    padding:0.5em 0.95em;background:${SB};flex-shrink:0;cursor:pointer;`;
  infoRow.innerHTML=`
    <span style="font-size:0.82em;font-weight:700;color:#3a2e1e;">ℹ️ About this map</span>
    <span id="info-chevron" style="font-size:0.72em;color:#666;">▼</span>`;
  sidebar.appendChild(infoRow);
  const infoPanel=document.createElement('div');
  infoPanel.id='info-panel';
  infoPanel.innerHTML=`Welcome to the Farever interactive map, built by the
    <a href="https://farever.wiki" target="_blank">Farever Wiki</a> team.<br><br>
    This map pulls data directly from the game. You can use the buttons to filter what is displayed.
    Note that some items have had their locations slightly obscured to avoid spoiling the fun of exploration!
    You will find them within the indicated area.<br><br>
    Please send any feedback about this map or the wiki to <strong>@IceCaveBear</strong> on Discord.`;
  sidebar.appendChild(infoPanel);
  infoRow.addEventListener('click',()=>{
    const open=infoPanel.style.display==='block';
    infoPanel.style.display=open?'none':'block';
    document.getElementById('info-chevron').textContent=open?'▼':'▲';
  });

  // Search
  sidebar.appendChild(sep());
  const searchDiv=document.createElement('div');
  searchDiv.style.cssText=`padding:0.55em 0.75em;flex-shrink:0;background:${SB};`;
  searchDiv.innerHTML=`<div style="display:flex;align-items:center;gap:0.3em;">
    <input id="sidebar-search" type="text" placeholder="🔍 Search markers…" style="
      flex:1;padding:0.38em 0.65em;border:1.5px solid #a09880;border-radius:4px;
      font-family:Noto,sans-serif;font-size:0.85em;background:rgb(232,228,218);color:#1a1a1a;outline:none;"/>
    <button id="sidebar-search-clear" style="display:none;padding:0.3em 0.55em;
      border:1.5px solid #a09880;border-radius:4px;background:rgb(232,228,218);
      color:#333;cursor:pointer;font-size:0.85em;">✕</button>
  </div>`;
  sidebar.appendChild(searchDiv);

  // Toolbar
  sidebar.appendChild(sep());
  const toolDiv=document.createElement('div');
  toolDiv.style.cssText=`padding:0.45em 0.75em;display:flex;gap:0.4em;flex-shrink:0;background:${SB};`;
  toolDiv.innerHTML=`
    <button id="btn-hide-completed" style="flex:1;padding:0.4em 0.5em;border:1.5px solid #a09880;
      border-radius:4px;background:rgb(232,228,218);color:#1a1a1a;cursor:pointer;
      font-family:Noto,sans-serif;font-size:0.78em;font-weight:600;">👁 Hide Completed</button>
    <button id="btn-reset-all" style="flex:1;padding:0.4em 0.5em;border:1.5px solid #a03020;
      border-radius:4px;background:rgb(232,228,218);color:#a03020;cursor:pointer;
      font-family:Noto,sans-serif;font-size:0.78em;font-weight:600;">🗑 Reset Completed</button>`;
  sidebar.appendChild(toolDiv);

  // Category list
  sidebar.appendChild(sep());
  const catList=document.createElement('div');
  catList.id='sidebar-cat-list';
  catList.style.cssText=`flex:1;overflow-y:auto;padding:0.2em 0;background:${SB};`;
  const sidebarIconUrls = {
    'Obelisks':'./icons/mapMarker5.png','Chests':'./icons/mapMarker2.png',
    'Orb chests':'./icons/mapMarker11.png','NPCs':'./icons/mapMarker8.png',
    'Dungeons':'./icons/mapMarker3.png','Checkpoints':'./icons/mapMarker6.png',
    'Minibosses':'./icons/mapMarker1.png',
  };
  const cm=getColourMap();
  Object.keys(layers).forEach(name=>{
    const colour=cm[name]||'#ffa958', total=categoryRegistry[name]?.total||0;
    const iconUrl=sidebarIconUrls[name];
    const indicator = iconUrl
      ? `<img src="${iconUrl}" style="width:22px;height:22px;object-fit:contain;flex-shrink:0;" alt="">`
      : `<span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${colour};flex-shrink:0;border:1.5px solid rgba(0,0,0,0.25);"></span>`;
    const row=document.createElement('label');
    row.style.cssText=`display:flex;align-items:center;gap:0.55em;padding:0.5em 0.95em;
      cursor:pointer;border-bottom:1px solid rgba(0,0,0,0.08);transition:background 0.1s;`;
    row.onmouseover=()=>row.style.background='rgba(0,0,0,0.06)';
    row.onmouseout=()=>row.style.background='';
    row.innerHTML=`
      <input type="checkbox" data-layer="${name}" class="category" style="display:none;"/>
      <span class="check--image"></span>
      ${indicator}
      <span style="flex:1;font-size:0.88em;font-weight:600;color:#1a1a1a;">${name}</span>
      <span class="sidebar-count" data-cat="${name}" style="font-size:0.8em;color:#555;flex-shrink:0;">0/${total}</span>`;
    catList.appendChild(row);
  });
  sidebar.appendChild(catList);

  // Footer: layout toggle
  sidebar.appendChild(sep());
  const footer=document.createElement('div');
  footer.id='sidebar-footer';
  const layoutBtn=document.createElement('button');
  layoutBtn.className='layout-btn';
  layoutBtn.textContent='⊞ Switch to Top Menu';
  footer.appendChild(layoutBtn);
  sidebar.appendChild(footer);

  document.body.appendChild(sidebar);

  // On mobile, sidebar overlays the map rather than pushing it
  const isMobile = () => window.innerWidth < 768;
  const effectiveW = () => isMobile() ? 0 : SIDEBAR_W;

  // Set initial map margin (0 on mobile — sidebar overlays)
  document.getElementById('map').style.marginRight = effectiveW() + 'px';

  // Collapse sidebar — orange button
  const collapseBtn = document.createElement('button');
  collapseBtn.id = 'sidebar-toggle';
  document.body.appendChild(collapseBtn);
  const mapEl = document.getElementById('map');
  let open = true;

  function updateCollapseBtnStyle() {
    const mobile = isMobile();
    if (mobile) {
      // Mobile: centred arrow tab at bottom of sidebar area
      collapseBtn.style.cssText = `
        position:fixed;bottom:0;left:50%;transform:translateX(-50%);
        z-index:1002;background:rgb(210,120,0);color:white;border:none;
        border-radius:8px 8px 0 0;padding:0.55em 1.8em 0.35em;cursor:pointer;
        font-size:1em;box-shadow:0 -2px 8px rgba(0,0,0,0.25);
        transition:transform 0.2s;`;
    } else {
      // Desktop: side tab at mid-right of sidebar
      collapseBtn.style.cssText = `
        position:fixed;top:50%;right:${open ? SIDEBAR_W : 0}px;transform:translateY(-50%);
        z-index:1001;background:rgb(210,120,0);color:white;border:none;
        border-radius:6px 0 0 6px;padding:0.7em 0.45em;cursor:pointer;
        font-size:0.85em;box-shadow:-2px 0 8px rgba(0,0,0,0.2);transition:right 0.25s ease;`;
    }
  }

  function setSidebarOpen(isOpen) {
    open = isOpen;
    const sw = SIDEBAR_W;
    sidebar.style.transform = isOpen ? '' : `translateX(${sw}px)`;
    mapEl.style.marginRight = (isOpen && !isMobile()) ? sw + 'px' : '0';
    if (isMobile()) {
      collapseBtn.innerHTML = isOpen ? '▼' : '▲';
    } else {
      collapseBtn.style.right = isOpen ? sw + 'px' : '0';
      collapseBtn.innerHTML = isOpen ? '▶' : '◀';
    }
    setTimeout(() => map.invalidateSize(), 260);
  }

  updateCollapseBtnStyle();
  collapseBtn.innerHTML = isMobile() ? '▼' : '▶';
  collapseBtn.addEventListener('click', () => setSidebarOpen(!open));

  window.addEventListener('resize', () => {
    updateCollapseBtnStyle();
    if (open) {
      mapEl.style.marginRight = isMobile() ? '0' : SIDEBAR_W + 'px';
      collapseBtn.innerHTML = isMobile() ? '▼' : '▶';
    } else {
      collapseBtn.innerHTML = isMobile() ? '▲' : '◀';
    }
  });

  // Checkboxes
  document.querySelectorAll('#sidebar-cat-list input[type="checkbox"]').forEach(cb=>{
    cb.addEventListener('change',e=>{
      const n=e.target.dataset.layer;
      e.target.checked?map.addLayer(layers[n]):map.removeLayer(layers[n]);
      updateLocalStorage();
    });
  });

  // Search
  let searchActive=false, savedVis={};
  const si=document.getElementById('sidebar-search'), sc=document.getElementById('sidebar-search-clear');
  si.addEventListener('input',()=>{
    const q=si.value.trim().toLowerCase();
    sc.style.display=q?'':'none';
    if(!q){clearSearch(layers,savedVis);searchActive=false;return;}
    if(!searchActive){
      document.querySelectorAll('#sidebar-cat-list input[type="checkbox"]').forEach(cb=>savedVis[cb.dataset.layer]=cb.checked);
      searchActive=true;
    }
    Object.keys(layers).forEach(n=>map.addLayer(layers[n]));
    allMarkers.forEach(({label,marker})=>{
      const d=getMarkerDomEl(marker);if(!d)return;
      const m=label.toLowerCase().includes(q);
      d.style.display=m?'':'none';d.style.outline=m?'3px solid #f39c12':'';
    });
  });
  sc.addEventListener('click',()=>{si.value='';sc.style.display='none';clearSearch(layers,savedVis);searchActive=false;});

  // Hide completed
  document.getElementById('btn-hide-completed').addEventListener('click',()=>{
    hideCompleted=!hideCompleted;
    const btn=document.getElementById('btn-hide-completed');
    btn.textContent=hideCompleted?'👁 Show Completed':'👁 Hide Completed';
    btn.style.background=hideCompleted?'rgb(200,195,180)':'rgb(232,228,218)';
    allMarkers.forEach(({markerId,marker})=>applyCompletedStyle(marker,completedMarkers.has(markerId)));
  });

  // Reset completed
  document.getElementById('btn-reset-all').addEventListener('click',()=>{
    if(!completedMarkers.size)return;
    if(!confirm(`Reset all ${completedMarkers.size} completed marker(s)? This cannot be undone.`))return;
    completedMarkers.clear();saveCompleted();
    allMarkers.forEach(({marker})=>{
      const d=getMarkerDomEl(marker);if(!d)return;
      d.style.opacity='';d.style.filter='';d.style.display='';
    });
    updateSidebarCounts();
  });

  // Layout toggle
  layoutBtn.addEventListener('click',()=>{
    layoutMode='top';localStorage.setItem('layoutMode','top');
    buildTopMenu(layers);loadChecked(layers);updateCounts();
    setTimeout(()=>map.invalidateSize(),280);
  });
}

// =========================================
// TOP MENU LAYOUT
// =========================================
function buildTopMenu(layers) {
  document.body.classList.add('top-menu-mode');
  document.getElementById('map').style.marginRight = '0';
  document.getElementById('sidebar')?.remove();
  document.getElementById('sidebar-toggle')?.remove();
  document.getElementById('top-ui')?.remove();
  // Remove any previous resize listener attached by this function
  if (window._topMenuResizeHandler) {
    window.removeEventListener('resize', window._topMenuResizeHandler);
    window._topMenuResizeHandler = null;
  }

  // Hide all original top-layout elements — we rebuild everything ourselves
  document.querySelectorAll('.text--area, .legend').forEach(el => el.style.display = 'none');

  const welcomeCollapsed = localStorage.getItem('topWelcomeCollapsed') === '1';
  const searchOpen       = false; // search always starts closed

  // =====================================================================
  // Build a single top-UI container inserted at top of page--flex
  // =====================================================================
  const ui = document.createElement('div');
  ui.id = 'top-ui';

  // ---- TOOLBAR ROW: filter chips + action buttons ----
  const toolbar = document.createElement('div');
  toolbar.id = 'top-toolbar';

  // Filter chips area
  const chipsWrap = document.createElement('div');
  chipsWrap.id = 'top-chips';

  const iconUrls = {
    'Obelisks':'./icons/mapMarker5.png','Chests':'./icons/mapMarker2.png',
    'Orb chests':'./icons/mapMarker11.png','NPCs':'./icons/mapMarker8.png',
    'Dungeons':'./icons/mapMarker3.png','Checkpoints':'./icons/mapMarker6.png',
    'Minibosses':'./icons/mapMarker1.png',
  };

  const cm = getColourMap();
  Object.keys(layers).forEach(name => {
    const colour = cm[name] || '#ffa958';
    const total  = categoryRegistry[name]?.total || 0;
    const iconUrl = iconUrls[name];
    const indicator = iconUrl
      ? `<img src="${iconUrl}" class="chip-icon-img" alt="">`
      : `<span class="chip-dot" style="background:${colour};"></span>`;
    const chip   = document.createElement('label');
    chip.className = 'top-chip';
    chip.style.setProperty('--chip-color', colour);
    chip.innerHTML = `
      <input type="checkbox" data-layer="${name}" class="category" style="display:none;">
      <span class="chip-check"></span>
      ${indicator}
      <span class="chip-name">${name}</span>
      <span class="top-count chip-count" data-cat="${name}">(${total})</span>`;
    chipsWrap.appendChild(chip);
  });

  // Right-side action buttons
  const actions = document.createElement('div');
  actions.id = 'top-actions';

  const mkBtn = (id, title, svgPath, label) => {
    const b = document.createElement('button');
    b.id = id; b.title = title;
    b.innerHTML = `<svg class="act-icon" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgPath}</svg><span class="act-label">${label}</span>`;
    return b;
  };

  const searchBtn = mkBtn('top-search-btn', 'Search markers',
    '<circle cx="6.5" cy="6.5" r="4"/><line x1="10" y1="10" x2="14" y2="14"/>',
    'Search');

  const hideBtn = mkBtn('top-hide-btn', 'Hide Completed',
    '<path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/>',
    'Hide Completed');

  const resetBtn = mkBtn('top-reset-btn', 'Reset Completed',
    '<polyline points="1,4 1,1 4,1"/><path d="M1 1 A7 7 0 1 1 1 9"/>',
    'Reset Completed');

  const welcomeBtn = document.createElement('button');
  welcomeBtn.id = 'top-welcome-btn';
  welcomeBtn.title = welcomeCollapsed ? 'Show info' : 'Hide info';
  welcomeBtn.innerHTML = `<svg class="act-icon" id="welcome-chevron" width="15" height="15" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,10 7,4 12,10"/></svg><span class="act-label">Info</span>`;

  const sideBtn = mkBtn('top-side-menu-btn', 'Switch to Side Menu',
    '<rect x="1" y="1" width="12" height="12" rx="1"/><line x1="9" y1="1" x2="9" y2="13"/>',
    'Side Menu');

  actions.appendChild(hideBtn);
  actions.appendChild(resetBtn);
  // NOTE: searchBtn, welcomeBtn, sideBtn all go to bottomRight as floating tabs

  // Bottom-right row: search + info + side menu tabs
  const bottomRow = document.createElement('div');
  bottomRow.id = 'top-bottom-row';

  // ---- SEARCH BAR — floats below the action column ----
  const searchBar = document.createElement('div');
  searchBar.id = 'top-search-bar';
  searchBar.innerHTML = `
    <input id="top-search-input" type="text" placeholder="Search markers…" autocomplete="off">
    <button id="top-search-clear" style="display:none;">✕</button>`;

  // ---- WELCOME PANEL — floats below the Info button ----
  const welcomePanel = document.createElement('div');
  welcomePanel.id = 'top-welcome-panel';
  if (welcomeCollapsed) welcomePanel.classList.add('collapsed');
  welcomePanel.innerHTML = `<div class="top-welcome-text">
    Welcome to the Farever interactive map, built by the <a href="https://farever.wiki" target="_blank">Farever Wiki</a> team.
    This map pulls data directly from the game. You can use the buttons to filter what is displayed.
    Note that some items have had their locations slightly obscured to avoid spoiling the fun of exploration!
    You will find them within the indicated area.
    Please send any feedback about this map or the wiki to <strong>@IceCaveBear</strong> on Discord.
  </div>`;

  // ---- TOOLBAR COLLAPSE button ----
  const toolbarCollapseBtn = document.createElement('button');
  toolbarCollapseBtn.id = 'top-toolbar-collapse-btn';
  toolbarCollapseBtn.title = 'Hide filter bar';
  toolbarCollapseBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,10 7,4 12,10"/></svg>`;

  const bottomLeft = document.createElement('div');
  bottomLeft.id = 'top-bottom-left';
  bottomLeft.appendChild(toolbarCollapseBtn);

  const bottomRight = document.createElement('div');
  bottomRight.id = 'top-bottom-right';

  // Search wrap — search button + popup
  const searchWrap = document.createElement('div');
  searchWrap.className = 'float-btn-wrap';
  searchWrap.appendChild(searchBtn);

  // Welcome wrap — info button + welcome panel popup
  const welcomeWrap = document.createElement('div');
  welcomeWrap.className = 'float-btn-wrap';
  welcomeWrap.appendChild(welcomeBtn);

  bottomRight.appendChild(searchWrap);
  bottomRight.appendChild(welcomeWrap);
  bottomRight.appendChild(sideBtn);
  if (window.innerWidth >= 768) bottomRight.appendChild(searchBar); // desktop: inside bottomRight
  bottomRow.appendChild(bottomLeft);
  bottomRow.appendChild(bottomRight);

  if (window.innerWidth < 768) {
    // Mobile: all three go into actions column
    actions.appendChild(searchBtn);
    actions.appendChild(welcomeBtn);
    actions.appendChild(sideBtn);
    // Icon-only mini buttons for collapsed state
    const mkIconOnly = (id, svg, title) => {
      const b = document.createElement('button');
      b.id = id + '-mini'; b.title = title; b.className = 'mini-float-btn';
      b.innerHTML = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svg}</svg>`;
      return b;
    };
    const miniSearch = mkIconOnly('top-search', '<circle cx="6.5" cy="6.5" r="4"/><line x1="10" y1="10" x2="14" y2="14"/>', 'Search');
    const miniSide   = mkIconOnly('top-side', '<rect x="1" y="1" width="12" height="12" rx="1"/><line x1="9" y1="1" x2="9" y2="13"/>', 'Side Menu');
    bottomRight.appendChild(miniSearch);
    bottomRight.appendChild(miniSide);
    bottomRight.style.display = 'none';
    const _wireMini = () => {
      miniSearch.addEventListener('click', () => searchIsOpen ? closeSearch() : openSearch());
      miniSide.addEventListener('click', () => {
        layoutMode = 'sidebar'; localStorage.setItem('layoutMode', 'sidebar');
        buildSidebar(layers); loadChecked(layers); updateCounts();
        setTimeout(() => map.invalidateSize(), 280);
      });
    };
    setTimeout(_wireMini, 0);
  } else {
    // Desktop: welcome panel inside its wrap; searchBar already appended to bottomRight above
    welcomeWrap.appendChild(welcomePanel);
  }

  // Action column wraps search bar on desktop (relative for popup positioning)
  const actionsWrap = document.createElement('div');
  actionsWrap.id = 'top-actions-wrap';
  actionsWrap.appendChild(actions);

  toolbar.appendChild(chipsWrap);
  toolbar.appendChild(actionsWrap);

  ui.appendChild(toolbar);
  ui.appendChild(bottomRow);
  // Mobile: searchBar and welcomePanel go AFTER bottomRow so they appear below the arrow
  if (window.innerWidth < 768) {
    ui.appendChild(searchBar);
    ui.appendChild(welcomePanel);
  }

  // Insert as first child of .page--flex
  const pageEl = document.querySelector('.page--flex');
  pageEl.insertBefore(ui, pageEl.firstChild);

  // Set map height to fill remaining viewport below top-ui
  function updateMapHeight() {
    const h = ui.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--top-ui-h', h + 'px');
    map.invalidateSize();
  }
  if (window.ResizeObserver) {
    new ResizeObserver(updateMapHeight).observe(ui);
  }
  setTimeout(updateMapHeight, 50);

  // On resize: just rebuild the whole top menu rather than moving DOM nodes
  let wasDesktop = window.innerWidth >= 768;
  const _resizeHandler = () => {
    const isDesktop = window.innerWidth >= 768;
    if (isDesktop === wasDesktop) return;
    wasDesktop = isDesktop;
    buildTopMenu(layers);
    loadChecked(layers);
    updateCounts();
    setTimeout(() => map.invalidateSize(), 280);
  };
  window._topMenuResizeHandler = _resizeHandler;
  window.addEventListener('resize', _resizeHandler);

  // =====================================================================
  // Wire up toolbar collapse (hides chips+actions, keeps floating tabs)
  // =====================================================================
  let toolbarCollapsed = localStorage.getItem('topToolbarCollapsed') === '1';
  const svgChevronUp   = `<polyline points="2,10 7,4 12,10"/>`;
  const svgChevronDown = `<polyline points="2,4 7,10 12,4"/>`;

  function applyToolbarCollapse(collapsed) {
    const mobile = window.innerWidth < 768;
    if (collapsed) {
      toolbar.style.display = 'none';
      if (!mobile) {
        // Desktop: collapse ui to 0 so map fills top, floating tabs remain
        ui.style.height = '0';
        ui.style.overflow = 'visible';
        ui.style.minHeight = '0';
      }
      // Mobile: show icon-only floating buttons (search + side)
      if (mobile) bottomRight.style.display = '';
    } else {
      toolbar.style.display = '';
      ui.style.height = '';
      ui.style.overflow = '';
      ui.style.minHeight = '';
      if (mobile) bottomRight.style.display = 'none';
    }
    toolbarCollapseBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${collapsed ? svgChevronDown : svgChevronUp}</svg>`;
    toolbarCollapseBtn.title = collapsed ? 'Show filter bar' : 'Hide filter bar';
    toolbarCollapsed = collapsed;
    localStorage.setItem('topToolbarCollapsed', collapsed ? '1' : '0');
    setTimeout(() => map.invalidateSize(), 50);
  }
  toolbar.style.transition = 'max-height 0.25s ease';
  applyToolbarCollapse(toolbarCollapsed);
  toolbarCollapseBtn.addEventListener('click', () => applyToolbarCollapse(!toolbarCollapsed));

  // =====================================================================
  // Wire up welcome toggle
  // =====================================================================
  const svgDown = `<polyline points="2,4 7,10 12,4"/>`;
  const svgUp   = `<polyline points="2,10 7,4 12,10"/>`;

  let welcomeIsCollapsed = welcomeCollapsed;

  function applyWelcome(collapsed) {
    // Both desktop and mobile use .open to show the panel
    welcomePanel.classList.toggle('open', !collapsed);
    const chevron = document.getElementById('welcome-chevron');
    if (chevron) chevron.innerHTML = collapsed ? svgDown : svgUp;
    welcomeBtn.title   = collapsed ? 'Show info' : 'Hide info';
    welcomeBtn.classList.toggle('active', !collapsed);
    welcomeIsCollapsed = collapsed;
    localStorage.setItem('topWelcomeCollapsed', collapsed ? '1' : '0');
    setTimeout(() => map.invalidateSize(), 260);
  }
  applyWelcome(welcomeCollapsed); // set initial icon

  welcomeBtn.addEventListener('click', () => applyWelcome(!welcomeIsCollapsed));

  // =====================================================================
  // Wire up search
  // =====================================================================
  let searchIsOpen = false;
  let searchActive = false;
  let savedVis = {};
  const searchInput = document.getElementById('top-search-input');
  const searchClear = document.getElementById('top-search-clear');

  function openSearch() {
    searchIsOpen = true;
    searchBar.classList.add('open');
    searchBtn.classList.add('active');
    setTimeout(() => searchInput.focus(), 50);
  }
  function closeSearch() {
    searchIsOpen = false;
    searchBar.classList.remove('open');
    searchBtn.classList.remove('active');
    searchInput.value = '';
    searchClear.style.display = 'none';
    clearSearch(layers, savedVis);
    searchActive = false;
  }

  searchBtn.addEventListener('click', () => searchIsOpen ? closeSearch() : openSearch());

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    searchClear.style.display = q ? '' : 'none';
    if (!q) { clearSearch(layers, savedVis); searchActive = false; return; }
    if (!searchActive) {
      document.querySelectorAll('.legend input[type="checkbox"]').forEach(cb => savedVis[cb.dataset.layer] = cb.checked);
      searchActive = true;
    }
    Object.keys(layers).forEach(n => map.addLayer(layers[n]));
    allMarkers.forEach(({ label, marker }) => {
      const d = getMarkerDomEl(marker); if (!d) return;
      const m = label.toLowerCase().includes(q);
      d.style.display  = m ? '' : 'none';
      d.style.outline  = m ? '3px solid #f39c12' : '';
    });
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.style.display = 'none';
    clearSearch(layers, savedVis);
    searchActive = false;
  });

  // =====================================================================
  // Wire up hide completed
  // =====================================================================
  function applyHideBtn() {
    hideBtn.classList.toggle('active', hideCompleted);
    hideBtn.title = hideCompleted ? 'Show Completed' : 'Hide Completed';
  }
  applyHideBtn();

  hideBtn.addEventListener('click', () => {
    hideCompleted = !hideCompleted;
    applyHideBtn();
    allMarkers.forEach(({ markerId, marker }) => applyCompletedStyle(marker, completedMarkers.has(markerId)));
  });

  // Reset completed
  document.getElementById('top-reset-btn').addEventListener('click', () => {
    if (!completedMarkers.size) return;
    if (!confirm(`Reset all ${completedMarkers.size} completed marker(s)?`)) return;
    completedMarkers.clear(); saveCompleted();
    allMarkers.forEach(({ marker }) => {
      const d = getMarkerDomEl(marker); if (!d) return;
      d.style.opacity = ''; d.style.filter = ''; d.style.display = '';
    });
    updateCounts();
  });

  // =====================================================================
  // Wire up checkboxes
  // =====================================================================
  document.querySelectorAll('#top-chips input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', e => {
      const n = e.target.dataset.layer;
      e.target.checked ? map.addLayer(layers[n]) : map.removeLayer(layers[n]);
      updateLocalStorage();
    });
  });

  // =====================================================================
  // Side menu switch
  // =====================================================================
  sideBtn.addEventListener('click', () => {
    layoutMode = 'sidebar';
    localStorage.setItem('layoutMode', 'sidebar');
    document.getElementById('map').style.marginRight = '0';
    buildSidebar(layers);
    loadChecked(layers);
    updateCounts();
    setTimeout(() => map.invalidateSize(), 280);
  });
}

// =========================================
// HELPERS
// =========================================
function sep(){const s=document.createElement('span');s.className='sidebar-separator';return s;}

function getColourMap(){
  return{
    'Misc':'#ffa958','Plants':'#ee74a3','Chests':'#c68a09','Orb chests':'#bb5b11',
    'Ores':'#8758d3','NPCs':'#27ad71','Haydn Seek':'#00d2d9','Obelisks':'rgb(110,26,199)',
    'Mobs':'#d13a3a','Sparkling mobs':'#eb19c8','Dungeons':'#430dd8','Checkpoints':'#4db3db',
    'Minibosses':'#eb681c','Critters':'#de58ff','Recipes':'#9b7700','Secret orbs':'#a23030',
  };
}

function clearSearch(layers,savedVis){
  const sel=layoutMode==='sidebar'?'#sidebar-cat-list input[type="checkbox"]':'#top-chips input[type="checkbox"]';
  document.querySelectorAll(sel).forEach(cb=>{
    const n=cb.dataset.layer, was=savedVis[n]!==undefined?savedVis[n]:cb.checked;
    was?map.addLayer(layers[n]):map.removeLayer(layers[n]);
  });
  allMarkers.forEach(({markerId,marker})=>{
    const d=getMarkerDomEl(marker);if(!d)return;
    d.style.outline='';applyCompletedStyle(marker,completedMarkers.has(markerId));
  });
}

loadData();

function updateLocalStorage(){
  const sel=layoutMode==='sidebar'?'#sidebar-cat-list input[type="checkbox"]':'#top-chips input[type="checkbox"]';
  const checked=[];
  document.querySelectorAll(sel).forEach(cb=>{if(cb.checked)checked.push(cb.dataset.layer);});
  localStorage.setItem('checkedBoxes',JSON.stringify(checked));
}

function loadChecked(layers){
  const saved=JSON.parse(localStorage.getItem('checkedBoxes'))||[];
  const sel=layoutMode==='sidebar'?'#sidebar-cat-list input[type="checkbox"]':'#top-chips input[type="checkbox"]';
  document.querySelectorAll(sel).forEach(input=>{
    const n=input.dataset.layer;
    if(saved.includes(n)){input.checked=true;map.addLayer(layers[n]);}
    else{input.checked=false;map.removeLayer(layers[n]);}
  });
}


