// ─── Map ──────────────────────────────────────────────────────────────────────
const map = L.map('map', {
  crs: L.CRS.Simple, minZoom: -8, tap: true, tapTolerance: 15,
  zoomControl: !(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768),
});
const bounds = [[0,0],[5120,3584]];
const s1=0.89, s2=0.89, b1=-1595, b2=1724, coordToMapScalar=0.89;
L.imageOverlay('cropped.webp', bounds).addTo(map);
map.fitBounds(bounds);
map.getContainer().addEventListener('contextmenu', e => e.preventDefault());
map.on('contextmenu', () => {});
const isMobile = () => window.innerWidth < 768;

// ─── Completed markers ────────────────────────────────────────────────────────
(function migrate() {
  const raw = localStorage.getItem('completedMarkers'); if (!raw) return;
  try { const a = JSON.parse(raw); if (!Array.isArray(a)||!a.length) return; if (!a.every(id=>/^.+__\d+$/.test(id))) localStorage.removeItem('completedMarkers'); } catch { localStorage.removeItem('completedMarkers'); }
})();
const completedMarkers = new Set(JSON.parse(localStorage.getItem('completedMarkers')||'[]'));
let hideCompleted = false;
const allMarkers = [];
const categoryRegistry = {};
function saveCompleted() { localStorage.setItem('completedMarkers', JSON.stringify([...completedMarkers])); }
function getMarkerId(item, idx) { return `${item.label}__${idx}`; }

// Collectable categories — only these can be marked complete
const COMPLETABLE = new Set(['Chests','Orb chests','Secret orbs','Recipes','Critters']);

function getMarkerEl(marker) {
  const el = marker.getElement(); if (!el) return null;
  return el.closest ? (el.closest('.leaflet-marker-icon') || el) : el;
}
function applyCompletedStyle(marker, done) {
  const el = getMarkerEl(marker); if (!el) return;
  el.classList.toggle('marker-done', done && !hideCompleted);
  el.classList.toggle('marker-done-hidden', done && hideCompleted);
  // tick overlay
  let tick = el.querySelector('.completed-tick');
  if (done) {
    if (!tick) { tick = document.createElement('div'); tick.className='completed-tick'; tick.textContent='✓'; el.style.position='relative'; el.appendChild(tick); }
  } else { tick?.remove(); }
}
function toggleComplete(mid, marker, category) {
  if (!COMPLETABLE.has(category)) return;
  completedMarkers.has(mid) ? completedMarkers.delete(mid) : completedMarkers.add(mid);
  saveCompleted();
  applyCompletedStyle(marker, completedMarkers.has(mid));
  updateCounts();
}

// ─── Colour / Icon maps ───────────────────────────────────────────────────────
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

// Filter group config: { title, icon(emoji), categories }
const FILTER_GROUPS = [
  { key:'zones',       title:'Zones',           icon:'🗺',  cats:[] }, // populated from regions
  { key:'npcs',        title:'NPCs',             icon:'👤', cats:['NPCs','Haydn Seek'] },
  { key:'poi',         title:'Points of Interest',icon:'⭐', cats:['Obelisks','Dungeons','Checkpoints'] },
  { key:'collectables',title:'Collectables',     icon:'📦', cats:['Chests','Secret orbs','Orb chests','Recipes','Critters'] },
  { key:'gatherables', title:'Gatherables',      icon:'🌿', cats:['Plants','Ores'], hasSub:true },
  { key:'enemies',     title:'Enemies',          icon:'⚔️', cats:['Mobs','Minibosses','Sparkling mobs'] },
];
// Plant and ore sub-labels
const ORE_SUBS = { 'Copper':['Copper Ore Large','Copper Ore Small'], 'Iron':['Iron Ore Small'], 'Tin':['Tin Ore Large','Tin Ore Small'], 'Tungstene':['Tungstene'] };
const PLANT_SUBS = { 'Madrigold':['Madrigold Large','Madrigold Small'], 'Lavendula':['Lavendula Large','Lavendula Small'], 'Ancient Thyme':['Ancient Thyme Large','Ancient Thyme Small'], 'Zealotus':['Zealotus','Zealotus Large','Zealotus Small'], 'Other Plants':['R 2Plant 2 Small','R 2Plant 3 Small','R 2Plant Rare Large','R 2Plant Rare Small'] };

// ─── SVGs ─────────────────────────────────────────────────────────────────────
const SVG = {
  search:  `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="6.5" cy="6.5" r="4"/><line x1="10" y1="10" x2="14" y2="14"/></svg>`,
  eye:     `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>`,
  eyeOff:  `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/><line x1="2" y1="2" x2="14" y2="14"/></svg>`,
  reset:   `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,4 1,1 4,1"/><path d="M1 1 A7 7 0 1 1 1 10"/></svg>`,
  compact: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="1" width="12" height="12" rx="1.5"/><line x1="5" y1="1" x2="5" y2="13"/></svg>`,
  full:    `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="1" width="12" height="12" rx="1.5"/><line x1="1" y1="5" x2="13" y2="5"/></svg>`,
  region:  `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7" cy="7" r="5"/><circle cx="7" cy="7" r="2"/></svg>`,
  subregion:`<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="10" height="10" rx="2"/></svg>`,
  zone:    `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="7,1 13,13 1,13"/></svg>`,
  pin:     `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M7 1a4 4 0 0 1 4 4c0 3-4 8-4 8S3 8 3 5a4 4 0 0 1 4-4z"/><circle cx="7" cy="5" r="1.5" fill="white"/></svg>`,
  route:   `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12 Q7 2 12 12"/><polyline points="10,10 12,12 10,14" fill="currentColor"/></svg>`,
  trash:   `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><polyline points="1,3 13,3"/><path d="M4 3V2h6v1"/><rect x="3" y="4" width="8" height="9" rx="1"/></svg>`,
};

// ─── Region label system ──────────────────────────────────────────────────────
let regionLabels = [];
let showRegions = localStorage.getItem('showRegions') !== '0';
let showSubregions = localStorage.getItem('showSubregions') !== '0';
let showZones = localStorage.getItem('showZones') !== '0';
const regionLayerGroup = L.layerGroup().addTo(map);

function getLabelCSS(tier, zoom) {
  const zf = Math.max(0.05, Math.pow(2, zoom));
  const sh = s => Math.max(1, Math.round(s * zf));
  if (tier === 'region') {
    const fs = Math.max(12, Math.round(26 * zf));
    return `font-family:Arial,sans-serif;font-size:${fs}px;font-weight:900;color:white;letter-spacing:0.1em;text-transform:uppercase;text-shadow:0 0 ${sh(9)}px rgba(0,0,0,0.95),0 0 ${sh(16)}px rgba(0,0,0,0.8),${sh(2)}px ${sh(2)}px 0 rgba(0,0,0,0.9);pointer-events:auto;cursor:default;white-space:nowrap;`;
  } else if (tier === 'subregion') {
    const fs = Math.max(8, Math.round(17 * zf));
    return `font-family:Arial,sans-serif;font-size:${fs}px;font-weight:700;font-style:italic;color:rgba(255,255,255,0.95);letter-spacing:0.05em;text-shadow:0 0 ${sh(6)}px rgba(0,0,0,0.95),${sh(1)}px ${sh(1)}px 0 rgba(0,0,0,0.85);pointer-events:auto;cursor:default;white-space:nowrap;`;
  } else {
    const fs = Math.max(6, Math.round(12 * zf));
    return `font-family:Arial,sans-serif;font-size:${fs}px;font-weight:500;color:rgba(255,255,255,0.88);letter-spacing:0.03em;text-shadow:0 0 ${sh(4)}px rgba(0,0,0,0.95),${sh(1)}px ${sh(1)}px 0 rgba(0,0,0,0.8);pointer-events:auto;cursor:default;white-space:nowrap;`;
  }
}
function makeRegionIcon(name, tier) {
  return L.divIcon({ html:`<div style="${getLabelCSS(tier,map.getZoom())}">${name}</div>`, className:'', iconAnchor:[0,0], iconSize:null });
}
function isRegionTierVisible(tier) {
  if (tier==='region') return showRegions;
  if (tier==='subregion') return showSubregions;
  return showZones;
}
function refreshRegionVisibility() {
  regionLabels.forEach(({marker, tier}) => {
    if (isRegionTierVisible(tier)) { if (!map.hasLayer(marker)) marker.addTo(regionLayerGroup); }
    else { regionLayerGroup.removeLayer(marker); }
  });
}
map.on('zoomend', () => {
  regionLabels.forEach(({marker, name, tier}) => {
    if (map.hasLayer(marker) || regionLayerGroup.hasLayer(marker)) marker.setIcon(makeRegionIcon(name, tier));
  });
});
async function loadRegions() {
  try {
    const r = await fetch('regions.json'); if (!r.ok) return;
    const data = await r.json();
    data.forEach(({name, tier, lat, lng}) => {
      const marker = L.marker([lat, lng], { icon: makeRegionIcon(name, tier), interactive:false, keyboard:false, zIndexOffset: tier==='region'?1000:tier==='subregion'?700:500 });
      regionLabels.push({name, tier, lat, lng, marker});
      if (isRegionTierVisible(tier)) marker.addTo(regionLayerGroup);
    });
  } catch(e) { console.warn('No regions.json:', e); }
}

// ─── Custom marker & route system ────────────────────────────────────────────
const CUSTOM_ICONS = ['📍','⚠️','❓','💡','🎯','🏆','💎','🗝️','🔮','⭐','🌟','💀','🔥','❄️','⚡','🌊','🌿','🍀','🌸','🎪','🏠','🏰','⛏️','🗡️','🛡️','🎭','🔔','📜','🗺️','🎁'];
const CUSTOM_COLOURS = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63','#ff5722','#607d8b','#795548','#ffffff'];
let customMode = null; // 'marker'|'route'|null
let customMarkers = JSON.parse(localStorage.getItem('customMarkers')||'[]');
let customRoutes  = JSON.parse(localStorage.getItem('customRoutes') ||'[]');
let pendingRoute  = []; // points being drawn
let selectedIcon  = '📍';
let selectedColour= '#e74c3c';
let customNote    = '';
const customLayerGroup = L.layerGroup().addTo(map);
const routeLayerGroup  = L.layerGroup().addTo(map);

function saveCustom() {
  localStorage.setItem('customMarkers', JSON.stringify(customMarkers.map(({lat,lng,icon,colour,note})=>({lat,lng,icon,colour,note}))));
  localStorage.setItem('customRoutes',  JSON.stringify(customRoutes.map(({points,colour})=>({points,colour}))));
}
function makeCustIcon(icon, colour) {
  return L.divIcon({ html:`<div style="font-size:1.5em;color:${colour};text-shadow:0 1px 4px rgba(0,0,0,0.6);line-height:1;pointer-events:auto;cursor:pointer;">${icon}</div>`, className:'', iconAnchor:[10,20], iconSize:null });
}
function renderCustomMarkers() {
  customLayerGroup.clearLayers();
  customMarkers.forEach((cm, i) => {
    const m = L.marker([cm.lat, cm.lng], { icon: makeCustIcon(cm.icon||'📍', cm.colour||'#e74c3c'), draggable:true });
    if (cm.note) m.bindPopup(`<div style="font-family:Noto,sans-serif;font-size:0.9em;">${cm.note}</div>`);
    m.on('contextmenu', e => { L.DomEvent.preventDefault(e); removeCustomMarker(i); });
    m.on('dragend', () => { const p=m.getLatLng(); cm.lat=p.lat; cm.lng=p.lng; saveCustom(); });
    m.addTo(customLayerGroup);
    cm._marker = m;
  });
}
function removeCustomMarker(i) { customMarkers.splice(i,1); saveCustom(); renderCustomMarkers(); renderCustomList(); }
function renderRoutes() {
  routeLayerGroup.clearLayers();
  customRoutes.forEach((route, ri) => {
    if (route.points.length < 2) return;
    for (let i=0; i<route.points.length-1; i++) {
      const a=route.points[i], b=route.points[i+1];
      // Arrow decorator line
      const line = L.polyline([[a[0],a[1]],[b[0],b[1]]], { color: route.colour||'#e74c3c', weight:3, opacity:0.85, smoothFactor:1 });
      // arrowhead via marker at midpoint
      const midLat=(a[0]+b[0])/2, midLng=(a[1]+b[1])/2;
      const angle = Math.atan2(b[1]-a[1], b[0]-a[0]) * 180/Math.PI;
      const arrow = L.divIcon({ html:`<div style="transform:rotate(${angle}deg);font-size:1em;color:${route.colour||'#e74c3c'};line-height:1;pointer-events:none;">➤</div>`, className:'', iconAnchor:[8,8] });
      L.marker([midLat,midLng], {icon:arrow, interactive:false}).addTo(routeLayerGroup);
      line.addTo(routeLayerGroup);
    }
  });
}
function addCustomMarkerAtLatLng(lat, lng) {
  const cm = { lat, lng, icon:selectedIcon, colour:selectedColour, note:customNote };
  customMarkers.push(cm); saveCustom(); renderCustomMarkers(); renderCustomList();
}
function finishRoute() {
  if (pendingRoute.length >= 2) {
    customRoutes.push({ points:[...pendingRoute], colour:selectedColour });
    saveCustom(); renderRoutes();
  }
  pendingRoute = [];
  if (window._routePreview) { map.removeLayer(window._routePreview); window._routePreview=null; }
  renderCustomList();
}

// ─── Load & init ──────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const r = await fetch('assets.json'); if (!r.ok) throw new Error(r.status);
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
    const cat = item.categories?.[0]||'Misc';
    if (!categoryRegistry[cat]) categoryRegistry[cat]={total:0,markerIds:[],subLabels:new Set()};
    categoryRegistry[cat].total++;
    categoryRegistry[cat].markerIds.push(getMarkerId(item,idx));
    categoryRegistry[cat].subLabels.add(item.label);
  });

  data.forEach((item, idx) => {
    const coords=[(s1*(4096-item.y)+b1),s2*(item.x+b2)];
    const cat=item.categories?.[0]||'Misc';
    if (!layers[cat]) layers[cat]=L.layerGroup();
    let m;
    if (cat in iconDict) m=L.marker(coords,{icon:L.icon(iconDict[cat])});
    else if (cat in circleDict) m=L.circle(coords,circleDict[cat]);
    else if (cat in stylingDict) m=L.circleMarker(coords,stylingDict[cat]);
    else m=L.circleMarker(coords,new cMarker().props);
    const mid=getMarkerId(item,idx);
    allMarkers.push({markerId:mid,marker:m,category:cat,label:item.label,coords});
    m.bindPopup(`<div style="text-align:center;font-family:Noto,sans-serif;">${item.label}</div>`);
    // Complete on right-click (desktop) or tap (mobile) — only for collectables
    m.on('contextmenu', e => { L.DomEvent.preventDefault(e); L.DomEvent.stopPropagation(e); m.closePopup(); toggleComplete(mid, m, cat); });
    m.on('click', e => {
      if (!isMobile()) return;
      if (customMode==='marker') return; // handled by map click
      toggleComplete(mid, m, cat);
    });
    m.on('add', () => setTimeout(()=>applyCompletedStyle(m,completedMarkers.has(mid)),0));
    m.addTo(layers[cat]);
  });

  buildSidebar(layers);
  loadChecked(layers);
  updateCounts();
  loadRegions();
  renderCustomMarkers();
  renderRoutes();

  // Map click for custom modes
  map.on('click', e => {
    if (customMode==='marker') { addCustomMarkerAtLatLng(e.latlng.lat, e.latlng.lng); }
    else if (customMode==='route') {
      pendingRoute.push([e.latlng.lat, e.latlng.lng]);
      if (window._routePreview) map.removeLayer(window._routePreview);
      if (pendingRoute.length >= 2) {
        window._routePreview = L.polyline(pendingRoute, {color:selectedColour,weight:3,dashArray:'6 4',opacity:0.7}).addTo(map);
      }
    }
  });
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function buildSidebar(layers) {
  document.getElementById('sidebar')?.remove();
  document.getElementById('sb-toggle')?.remove();
  document.getElementById('sb-search-float')?.remove();
  document.getElementById('sb-tooltip')?.remove();

  const savedView = localStorage.getItem('sbView')||'full';
  const aboutOpen = localStorage.getItem('sbAboutOpen')!=='0';

  const sidebar = mk('div',{id:'sidebar'});
  if (savedView==='compact') sidebar.classList.add('compact');

  // ── Header ──────────────────────────────────────────────────────
  const hdr = mk('div',{id:'sb-header'});
  const title = mk('span',{id:'sb-title'}); title.textContent='Farever Map';
  const viewBtns = mk('div',{id:'sb-view-btns'});
  const btnTV = mk('button',{id:'sb-btn-toggle-view',class:'sb-view-btn'});
  const isCompact = () => sidebar.classList.contains('compact');
  const updateViewBtn = () => { btnTV.innerHTML=isCompact()?SVG.full:SVG.compact; btnTV.setAttribute('data-tip',isCompact()?'Expand':'Compact'); };
  updateViewBtn();
  viewBtns.appendChild(btnTV);
  hdr.appendChild(title); hdr.appendChild(viewBtns);
  sidebar.appendChild(hdr);
  sidebar.appendChild(sep());

  // ── About ────────────────────────────────────────────────────────
  const aboutRow = mk('div',{id:'sb-about-row',class:'full-only'});
  aboutRow.innerHTML=`<span>ℹ️ About</span><span id="sb-about-chevron">${aboutOpen?'▲':'▼'}</span>`;
  const aboutPanel = mk('div',{id:'sb-about-panel',class:'full-only'});
  aboutPanel.style.display = aboutOpen?'block':'none';
  aboutPanel.innerHTML=`Welcome to the Farever interactive map by the <a href="https://farever.wiki" target="_blank">Farever Wiki</a> team.<br><br>Data pulled directly from the game. Feedback: <strong>@IceCaveBear</strong> on Discord.`;
  aboutRow.addEventListener('click',()=>{ const o=aboutPanel.style.display==='block'; aboutPanel.style.display=o?'none':'block'; document.getElementById('sb-about-chevron').textContent=o?'▼':'▲'; localStorage.setItem('sbAboutOpen',o?'0':'1'); });
  sidebar.appendChild(aboutRow); sidebar.appendChild(aboutPanel);
  sidebar.appendChild(sep({id:'sb-sep-about'}));

  // ── Tabs ─────────────────────────────────────────────────────────
  const tabBar = mk('div',{id:'sb-tabs',class:'full-only'});
  const tabs = [
    {key:'filter',  label:'🔍 Filter'},
    {key:'zones',   label:'🗺 Regions'},
    {key:'custom',  label:'📍 Custom'},
  ];
  tabs.forEach(t => {
    const btn = mk('button',{class:'sb-tab'+(t.key==='filter'?' active':'')}); btn.dataset.tab=t.key; btn.innerHTML=t.label;
    btn.addEventListener('click',()=>{
      tabBar.querySelectorAll('.sb-tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      sidebar.querySelectorAll('.sb-panel').forEach(p=>p.classList.remove('active'));
      document.getElementById(`sb-panel-${t.key}`)?.classList.add('active');
    });
    tabBar.appendChild(btn);
  });
  sidebar.appendChild(tabBar);

  // ── Tool buttons (compact-only search + hide + reset) ────────────
  const iconTools = mk('div',{id:'sb-icon-tools'});
  const searchToolBtn = mkToolBtn('sb-search-tool',SVG.search,'Search'); searchToolBtn.classList.add('compact-only');
  const hideBtn = mkToolBtn('sb-hide-btn',SVG.eye,'Hide Completed');
  const resetBtn = mkToolBtn('sb-reset-btn',SVG.reset,'Reset Completed');
  iconTools.appendChild(searchToolBtn); iconTools.appendChild(hideBtn); iconTools.appendChild(resetBtn);
  sidebar.appendChild(iconTools);
  sidebar.appendChild(sep());

  // ── Zone label toggles ───────────────────────────────────────────
  const zoneTogs = mk('div',{id:'sb-zone-toggles'});
  const togData = [{key:'region',label:'Regions',svg:SVG.region},{key:'subregion',label:'Sub',svg:SVG.subregion},{key:'zone',label:'Zones',svg:SVG.zone}];
  const togBtns = {};
  togData.forEach(({key,label,svg}) => {
    const btn = mk('button',{class:'zone-tog-btn'+(isRegionTierVisible(key)?' active':'')});
    btn.innerHTML = `${svg} ${label}`;
    btn.addEventListener('click',()=>{
      if (key==='region') { showRegions=!showRegions; localStorage.setItem('showRegions',showRegions?'1':'0'); btn.classList.toggle('active',showRegions); }
      else if (key==='subregion') { showSubregions=!showSubregions; localStorage.setItem('showSubregions',showSubregions?'1':'0'); btn.classList.toggle('active',showSubregions); }
      else { showZones=!showZones; localStorage.setItem('showZones',showZones?'1':'0'); btn.classList.toggle('active',showZones); }
      refreshRegionVisibility();
    });
    togBtns[key]=btn; zoneTogs.appendChild(btn);
  });
  sidebar.appendChild(zoneTogs);
  sidebar.appendChild(sep());

  // ── Panel: Filter ────────────────────────────────────────────────
  const filterPanel = mk('div',{id:'sb-panel-filter',class:'sb-panel active'});

  // Search
  const searchRow = mk('div',{id:'sb-search-row',class:'full-only'});
  searchRow.innerHTML=`<input id="sb-search" type="text" placeholder="🔍 Search markers…" autocomplete="off"><button id="sb-search-clear" style="display:none">✕</button>`;
  filterPanel.appendChild(searchRow);
  filterPanel.appendChild(sep());

  // Category list with groups
  const catList = mk('div',{id:'sb-cat-list'});

  FILTER_GROUPS.forEach(group => {
    if (group.key==='zones') return; // handled by zone toggles
    const groupDiv = mk('div',{class:'filter-group'});
    const groupSaved = localStorage.getItem(`fg_${group.key}`);
    if (groupSaved==='1') groupDiv.classList.add('collapsed');

    // Group header
    const ghdr = mk('div',{class:'filter-group-header'});
    let allHidden = group.cats.every(c => hiddenGroups.has(c));
    ghdr.innerHTML=`<div class="fgh-left"><span>${group.icon}</span><span class="fgh-title">${group.title}</span></div><div style="display:flex;align-items:center;gap:0.4em"><button class="fgh-eye${allHidden?' hidden':''}" title="Show/hide all" data-group="${group.key}">${allHidden?SVG.eyeOff:SVG.eye}</button><span class="fgh-chevron">▼</span></div>`;
    ghdr.querySelector('.filter-group-header > div:last-child > .fgh-chevron, .fgh-chevron')?.addEventListener && ghdr.addEventListener('click', e => {
      if (e.target.closest('.fgh-eye')) return;
      groupDiv.classList.toggle('collapsed');
      localStorage.setItem(`fg_${group.key}`, groupDiv.classList.contains('collapsed')?'1':'0');
    });
    ghdr.querySelector('.fgh-eye').addEventListener('click', e => {
      e.stopPropagation();
      const btn = e.currentTarget;
      const grp = btn.dataset.group;
      const nowHiding = !btn.classList.contains('hidden');
      btn.classList.toggle('hidden', nowHiding);
      btn.innerHTML = nowHiding ? SVG.eyeOff : SVG.eye;
      group.cats.forEach(cat => {
        if (nowHiding) { hiddenGroups.add(cat); if (layers[cat]) map.removeLayer(layers[cat]); }
        else { hiddenGroups.delete(cat); const cb = document.querySelector(`input[data-layer="${cat}"]`); if (cb?.checked && layers[cat]) map.addLayer(layers[cat]); }
      });
    });
    groupDiv.appendChild(ghdr);

    const groupRows = mk('div',{class:'filter-group-rows'});

    if (group.hasSub) {
      // Gatherables: Plants + Ores each with sub-filters
      ['Plants','Ores'].forEach(mainCat => {
        const subs = mainCat==='Plants' ? PLANT_SUBS : ORE_SUBS;
        const subDiv = mk('div',{class:'filter-subgroup'});
        const subSaved = localStorage.getItem(`fsg_${mainCat}`);
        if (subSaved==='1') subDiv.classList.add('collapsed');
        const colour = COLOURS[mainCat]||'#ffa958';
        const shdr = mk('div',{class:'filter-subgroup-header'});
        shdr.innerHTML=`<span class="fsh-title" style="color:${colour}">${mainCat}</span><span class="fsh-chevron">▼</span><button class="fsh-eye" title="Show/hide ${mainCat}">${SVG.eye}</button>`;
        shdr.addEventListener('click', e => {
          if (e.target.closest('.fsh-eye')) return;
          subDiv.classList.toggle('collapsed');
          localStorage.setItem(`fsg_${mainCat}`, subDiv.classList.contains('collapsed')?'1':'0');
        });
        shdr.querySelector('.fsh-eye').addEventListener('click', e => {
          e.stopPropagation();
          const btn = e.currentTarget;
          const nowHiding = !btn.classList.contains('hidden');
          btn.classList.toggle('hidden', nowHiding);
          btn.innerHTML = nowHiding ? SVG.eyeOff : SVG.eye;
          if (nowHiding) { hiddenGroups.add(mainCat); if (layers[mainCat]) map.removeLayer(layers[mainCat]); }
          else { hiddenGroups.delete(mainCat); const cb=document.querySelector(`input[data-layer="${mainCat}"]`); if (cb?.checked && layers[mainCat]) map.addLayer(layers[mainCat]); }
        });
        subDiv.appendChild(shdr);
        const subRows = mk('div',{class:'filter-subgroup-rows'});
        // Main category row
        subRows.appendChild(buildCatRow(mainCat, layers));
        // Sub-label filter rows
        Object.entries(subs).forEach(([subName, subLabels]) => {
          const subRow = mk('div',{class:'sb-cat-row sub'}); subRow.setAttribute('data-tip',subName);
          const dot = `<span class="sb-cat-dot-wrap"><span class="sb-cat-dot" style="background:${colour}"></span></span>`;
          subRow.innerHTML=`<span class="sb-cat-name" style="color:${colour};font-size:0.78em">${subName}</span><span class="sb-cat-count" id="sub-count-${subName.replace(/\s/g,'_')}"></span>`;
          subRow.style.cursor='default'; // sub filters are visual only for now
          subRows.appendChild(subRow);
        });
        subDiv.appendChild(subRows);
        groupRows.appendChild(subDiv);
      });
    } else {
      group.cats.forEach(cat => { if (layers[cat]) groupRows.appendChild(buildCatRow(cat, layers)); });
    }
    groupDiv.appendChild(groupRows);
    catList.appendChild(groupDiv);
  });

  filterPanel.appendChild(catList);

  // Scroll indicators
  const scrollUp = mk('div',{id:'sb-scroll-up'});
  const scrollDn = mk('div',{id:'sb-scroll-down'});
  scrollUp.innerHTML=`<svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,7 6,1 11,7"/></svg>`;
  scrollDn.innerHTML=`<svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,1 6,7 11,1"/></svg>`;
  filterPanel.insertBefore(scrollUp, catList);
  filterPanel.appendChild(scrollDn);
  function updateScrollIndicators() {
    scrollUp.style.display = catList.scrollTop > 8 ? 'flex' : 'none';
    scrollDn.style.display = (catList.scrollHeight - catList.scrollTop - catList.clientHeight) > 8 ? 'flex' : 'none';
  }
  catList.addEventListener('scroll', updateScrollIndicators);
  btnTV.addEventListener('click', () => setTimeout(updateScrollIndicators, 300));
  requestAnimationFrame(() => setTimeout(updateScrollIndicators, 50));
  window.addEventListener('resize', updateScrollIndicators);

  sidebar.appendChild(filterPanel);

  // ── Panel: Regions (zone toggle info) ───────────────────────────
  const zonesPanel = mk('div',{id:'sb-panel-zones',class:'sb-panel'});
  zonesPanel.innerHTML=`<div style="padding:0.8em;font-size:0.82em;color:#3a2e1e;line-height:1.6;font-weight:600;">Use the <strong>Regions / Sub / Zones</strong> buttons above to show or hide each tier of map labels.<br><br>Labels are loaded from <code>regions.json</code> and rendered directly on the map at their correct map coordinates.</div>`;
  sidebar.appendChild(zonesPanel);

  // ── Panel: Custom ────────────────────────────────────────────────
  const customPanel = mk('div',{id:'sb-panel-custom',class:'sb-panel'});
  buildCustomPanel(customPanel);
  sidebar.appendChild(customPanel);

  // ── Hint bar ────────────────────────────────────────────────────
  const hint = mk('div',{id:'sb-hint'});
  sidebar.appendChild(sep({id:'sb-sep-hint'}));
  const updateHint = () => {
    hint.innerHTML = isMobile()
      ? `<span class="sb-hint-icon">👆</span><span class="sb-hint-text"><strong>Tap</strong> a collectable marker to mark it complete</span>`
      : `<span class="sb-hint-icon">🖱️</span><span class="sb-hint-text"><strong>Right-click</strong> a collectable to mark it complete</span>`;
  };
  updateHint();
  window.addEventListener('resize', updateHint);
  sidebar.appendChild(hint);
  document.body.appendChild(sidebar);

  // ── Toggle arrow ────────────────────────────────────────────────
  const toggle = mk('button',{id:'sb-toggle'});
  document.body.appendChild(toggle);

  // ── Floating search ─────────────────────────────────────────────
  const floatSearch = mk('div',{id:'sb-search-float'});
  const floatBtn = mk('button',{id:'sb-search-float-btn'}); floatBtn.innerHTML=SVG.search;
  const floatPanel = mk('div',{id:'sb-search-float-panel',style:'display:none'});
  const floatInput = mk('input'); Object.assign(floatInput,{type:'text',placeholder:'Search markers…',id:'sb-float-input',autocomplete:'off'});
  const floatClose = mk('button',{id:'sb-float-close'}); floatClose.innerHTML=`<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>`;
  floatPanel.appendChild(floatInput); floatPanel.appendChild(floatClose);
  floatSearch.appendChild(floatBtn); floatSearch.appendChild(floatPanel);
  document.body.appendChild(floatSearch);
  let floatOpen=false;
  floatBtn.addEventListener('click',()=>{ floatOpen=!floatOpen; floatPanel.style.display=floatOpen?'flex':'none'; floatBtn.classList.toggle('active',floatOpen); if(floatOpen) setTimeout(()=>floatInput.focus(),50); else { floatInput.value=''; clearSearch(layers,{}); } });
  floatClose.addEventListener('click',()=>{ floatOpen=false; floatPanel.style.display='none'; floatBtn.classList.toggle('active',false); floatInput.value=''; loadChecked(layers); clearSearch(layers,{}); });
  wireSearch(floatInput, null, floatPanel, layers, null);

  // ── JS tooltip shared div ────────────────────────────────────────
  const sbTip = mk('div',{id:'sb-tooltip'});
  sbTip.style.cssText=`position:fixed;background:rgba(0,0,0,0.85);color:white;font-size:0.88em;font-weight:600;padding:0.35em 0.65em;border-radius:4px;pointer-events:none;z-index:2000;display:none;white-space:nowrap;`;
  document.body.appendChild(sbTip);
  function attachTip(el, getTip) {
    el.addEventListener('mouseover', e=>{ const row=e.target.closest('[data-tip]'); if(!row||!isCompact()) return; sbTip.textContent=getTip(row); sbTip.style.display='block'; });
    el.addEventListener('mousemove', e=>{ const row=e.target.closest('[data-tip]'); if(!row||!isCompact()){sbTip.style.display='none';return;} const r=row.getBoundingClientRect(); sbTip.style.top=(r.top+r.height/2-sbTip.offsetHeight/2)+'px'; sbTip.style.left=(r.left-sbTip.offsetWidth-10)+'px'; });
    el.addEventListener('mouseleave',()=>sbTip.style.display='none');
  }
  attachTip(catList, row=>row.getAttribute('data-tip'));
  attachTip(iconTools, row=>row.getAttribute('data-tip'));
  btnTV.addEventListener('click', ()=>sbTip.style.display='none');

  // ── State & layout ──────────────────────────────────────────────
  let sidebarOpen = savedView!=='closed';
  function curW() { return isCompact()?(isMobile()?52:52):(isMobile()?290:320); }
  function saveView() { localStorage.setItem('sbView',!sidebarOpen?'closed':isCompact()?'compact':'full'); }
  function applyLayout(animate) {
    if (!animate) { sidebar.style.transition='none'; toggle.style.transition='none'; }
    const w=curW();
    sidebar.style.transform=sidebarOpen?'':(`translateX(${w}px)`);
    toggle.style.right=sidebarOpen?w+'px':'0';
    toggle.innerHTML=sidebarOpen?'▶':'◀';
    floatSearch.style.display=sidebarOpen?'none':'flex';
    if (!animate) requestAnimationFrame(()=>{sidebar.style.transition='';toggle.style.transition='';});
  }
  toggle.addEventListener('click',()=>{ sidebarOpen=!sidebarOpen; saveView(); applyLayout(true); document.getElementById('sb-search-float-panel').style.display='none'; floatOpen=false; });
  btnTV.addEventListener('click',()=>{ sidebar.classList.toggle('compact'); updateViewBtn(); saveView(); applyLayout(true); });
  searchToolBtn.addEventListener('click',()=>{ buildFloatingSearch(layers, searchToolBtn); });
  applyLayout(false);
  window.addEventListener('resize',()=>applyLayout(false));

  // ── Checkboxes ──────────────────────────────────────────────────
  document.querySelectorAll('#sb-cat-list input[type="checkbox"]').forEach(cb=>{
    cb.addEventListener('change',e=>{ const n=e.target.dataset.layer; if (!hiddenGroups.has(n)) { e.target.checked?map.addLayer(layers[n]):map.removeLayer(layers[n]); } updateLocalStorage(); });
  });

  // ── Search ──────────────────────────────────────────────────────
  wireSearch(
    document.getElementById('sb-search'),
    document.getElementById('sb-search-clear'),
    document.getElementById('sb-search-row'),
    layers,
    ()=>{ if(isMobile()){sidebarOpen=false; saveView(); applyLayout(true);} }
  );

  // ── Hide completed ───────────────────────────────────────────────
  hideBtn.addEventListener('click',()=>{
    hideCompleted=!hideCompleted;
    hideBtn.classList.toggle('active',hideCompleted);
    hideBtn.innerHTML=`${hideCompleted?SVG.eyeOff:SVG.eye}<span class="sb-tool-label">${hideCompleted?'Show Completed':'Hide Completed'}</span>`;
    hideBtn.setAttribute('data-tip',hideCompleted?'Show Completed':'Hide Completed');
    allMarkers.forEach(({markerId,marker})=>applyCompletedStyle(marker,completedMarkers.has(markerId)));
  });

  // ── Reset completed ──────────────────────────────────────────────
  resetBtn.addEventListener('click',()=>{
    if (!completedMarkers.size) return;
    if (!confirm(`Reset all ${completedMarkers.size} completed marker(s)?`)) return;
    completedMarkers.clear(); saveCompleted();
    allMarkers.forEach(({marker})=>{ const el=getMarkerEl(marker); if(!el) return; el.classList.remove('marker-done','marker-done-hidden'); el.querySelector('.completed-tick')?.remove(); });
    updateCounts();
  });
}

// ─── Build a single category row ─────────────────────────────────────────────
const hiddenGroups = new Set();
function buildCatRow(name, layers) {
  const colour = COLOURS[name]||'#ffa958';
  const iconUrl = ICONS[name];
  const total = categoryRegistry[name]?.total||0;
  const row = mk('label',{class:'sb-cat-row'}); row.setAttribute('data-tip',name);
  const indicator = iconUrl
    ? `<img src="${iconUrl}" class="sb-cat-icon" alt="">`
    : `<span class="sb-cat-dot-wrap"><span class="sb-cat-dot" style="background:${colour}"></span></span>`;
  row.innerHTML=`<input type="checkbox" data-layer="${name}" class="category" style="display:none"><span class="sb-check-img"></span>${indicator}<span class="sb-cat-name" style="color:${colour}">${name}</span><span class="sb-cat-count" data-cat="${name}">0/${total}</span>`;
  return row;
}

// ─── Custom panel builder ─────────────────────────────────────────────────────
function buildCustomPanel(panel) {
  panel.innerHTML='';
  const scroll = mk('div',{style:'flex:1;overflow-y:auto;padding:0.5em 0.75em;display:flex;flex-direction:column;gap:0.5em;'});

  // Mode buttons
  const modeIndicator = mk('div',{class:'custom-mode-indicator'}); modeIndicator.textContent='Select a mode below';
  const modeRow = mk('div',{class:'mode-row'});
  const btnMarker = mk('button',{class:'custom-btn custom-btn-primary'+(customMode==='marker'?' active':'')}); btnMarker.innerHTML=`${SVG.pin} Place Marker`;
  const btnRoute  = mk('button',{class:'custom-btn custom-btn-secondary'+(customMode==='route'?' active':'')}); btnRoute.innerHTML=`${SVG.route} Draw Route`;
  const btnDone   = mk('button',{class:'custom-btn custom-btn-secondary'}); btnDone.textContent='✓ Done / Cancel';
  modeRow.appendChild(btnMarker); modeRow.appendChild(btnRoute); modeRow.appendChild(btnDone);
  btnMarker.addEventListener('click',()=>{ customMode=customMode==='marker'?null:'marker'; btnMarker.classList.toggle('active',customMode==='marker'); btnRoute.classList.remove('active'); modeIndicator.textContent=customMode==='marker'?'Click map to place marker':'Select a mode'; });
  btnRoute.addEventListener('click',()=>{ customMode=customMode==='route'?null:'route'; btnRoute.classList.toggle('active',customMode==='route'); btnMarker.classList.remove('active'); modeIndicator.textContent=customMode==='route'?'Click map to draw route (Done to finish)':'Select a mode'; });
  btnDone.addEventListener('click',()=>{ if(customMode==='route') finishRoute(); customMode=null; btnMarker.classList.remove('active'); btnRoute.classList.remove('active'); modeIndicator.textContent='Mode cancelled'; });

  // Icon selector
  const iconTitle = mk('div',{class:'custom-section-title'}); iconTitle.textContent='Icon';
  const iconGrid = mk('div',{class:'custom-icon-grid'});
  CUSTOM_ICONS.forEach(ic=>{ const b=mk('div',{class:'cust-icon-btn'+(ic===selectedIcon?' selected':'')}); b.textContent=ic; b.addEventListener('click',()=>{ selectedIcon=ic; iconGrid.querySelectorAll('.cust-icon-btn').forEach(x=>x.classList.remove('selected')); b.classList.add('selected'); }); iconGrid.appendChild(b); });

  // Colour selector
  const colTitle = mk('div',{class:'custom-section-title'}); colTitle.textContent='Colour';
  const colRow = mk('div',{class:'color-swatch-row'});
  CUSTOM_COLOURS.forEach(col=>{ const s=mk('div',{class:'color-swatch'+(col===selectedColour?' selected':'')}); s.style.background=col; s.addEventListener('click',()=>{ selectedColour=col; colRow.querySelectorAll('.color-swatch').forEach(x=>x.classList.remove('selected')); s.classList.add('selected'); }); colRow.appendChild(s); });

  // Note input
  const noteTitle = mk('div',{class:'custom-section-title'}); noteTitle.textContent='Note (optional)';
  const noteInput = mk('textarea',{class:'custom-input',rows:'2',placeholder:'Add a personal note…'}); noteInput.addEventListener('input',()=>customNote=noteInput.value);

  // Placed items list
  const listTitle = mk('div',{class:'custom-section-title'}); listTitle.id='custom-list-title';
  const listDiv = mk('div',{class:'custom-list',style:'max-height:12em;'}); listDiv.id='custom-list';

  scroll.appendChild(modeIndicator);
  scroll.appendChild(modeRow);
  scroll.appendChild(iconTitle); scroll.appendChild(iconGrid);
  scroll.appendChild(colTitle); scroll.appendChild(colRow);
  scroll.appendChild(noteTitle); scroll.appendChild(noteInput);
  scroll.appendChild(listTitle); scroll.appendChild(listDiv);
  panel.appendChild(scroll);
  renderCustomList();
}
function renderCustomList() {
  const listDiv = document.getElementById('custom-list'); if (!listDiv) return;
  const listTitle = document.getElementById('custom-list-title');
  const total = customMarkers.length + customRoutes.length;
  if (listTitle) listTitle.textContent=`Saved (${total})`;
  listDiv.innerHTML='';
  customMarkers.forEach((cm, i)=>{
    const row = mk('div',{class:'custom-list-item'});
    row.innerHTML=`<span style="color:${cm.colour||'#e74c3c'}">${cm.icon||'📍'}</span><span style="flex:1;font-size:0.82em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${cm.note||'Custom marker'}</span>`;
    const del = mk('button',{class:'custom-del-btn',title:'Delete'}); del.innerHTML=SVG.trash;
    del.addEventListener('click',()=>removeCustomMarker(i));
    row.appendChild(del); listDiv.appendChild(row);
  });
  customRoutes.forEach((rt, i)=>{
    const row = mk('div',{class:'custom-list-item'});
    row.innerHTML=`<span style="color:${rt.colour||'#e74c3c'}">${SVG.route}</span><span style="flex:1;font-size:0.82em">Route (${rt.points.length} pts)</span>`;
    const del = mk('button',{class:'custom-del-btn',title:'Delete'}); del.innerHTML=SVG.trash;
    del.addEventListener('click',()=>{ customRoutes.splice(i,1); saveCustom(); renderRoutes(); renderCustomList(); });
    row.appendChild(del); listDiv.appendChild(row);
  });
}

// ─── Floating search (compact mode) ──────────────────────────────────────────
function buildFloatingSearch(layers, anchorEl) {
  const existing = document.getElementById('sb-search-float-panel');
  if (existing && existing.style.display!=='none') { existing.style.display='none'; return; }
  const sidebarEl = document.getElementById('sidebar');
  const sbRect = sidebarEl?.getBoundingClientRect();
  const anchorRect = anchorEl?.getBoundingClientRect();
  const wrap = mk('div',{id:'sb-search-float'});
  wrap.style.cssText=`position:fixed;right:${sbRect?(window.innerWidth-sbRect.left+8):320}px;top:${anchorRect?anchorRect.top:200}px;z-index:1200;display:flex;align-items:center;`;
  const panel = mk('div',{id:'sb-search-float-panel',style:'display:flex;align-items:center;background:rgb(232,228,218);border:1.5px solid #a09880;border-radius:6px;padding:0.35em 0.5em;gap:0.3em;box-shadow:0 3px 10px rgba(0,0,0,0.25);'});
  const inp = mk('input'); Object.assign(inp,{type:'text',placeholder:'Search markers…',id:'sb-float-input',autocomplete:'off',style:'background:transparent;border:none;font-family:Noto,sans-serif;font-size:0.9em;color:#1a1a1a;outline:none;width:200px;'});
  const cls = mk('button',{id:'sb-float-close',style:'background:none;border:none;cursor:pointer;color:#777;padding:0.15em;display:flex;align-items:center;border-radius:3px;'}); cls.innerHTML=`<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>`;
  panel.appendChild(inp); panel.appendChild(cls); wrap.appendChild(panel);
  document.getElementById('sb-search-float')?.remove();
  document.body.appendChild(wrap);
  setTimeout(()=>inp.focus(),50);
  cls.addEventListener('click',()=>{ loadChecked(layers); clearSearch(layers,{}); wrap.remove(); });
  wireSearch(inp, null, panel, layers, null);
}

// ─── Search wiring ────────────────────────────────────────────────────────────
function wireSearch(input, clearBtn, container, layers, onResultClick) {
  let searchActive=false, savedVis={}, resultsBox=null;
  function removeResults(){ resultsBox?.remove(); resultsBox=null; }
  function doSearch(q) {
    removeResults(); if (!q){ clearSearch(layers,savedVis); searchActive=false; return; }
    if (!searchActive){ document.querySelectorAll('#sb-cat-list input[type="checkbox"]').forEach(cb=>savedVis[cb.dataset.layer]=cb.checked); searchActive=true; }
    Object.keys(layers).forEach(n=>map.addLayer(layers[n]));
    // Also search region labels
    const regionMatches = regionLabels.filter(({name})=>name.toLowerCase().includes(q));
    const markerMatches = allMarkers.filter(({label})=>label.toLowerCase().includes(q));
    allMarkers.forEach(({label,marker})=>{ const el=getMarkerEl(marker); if(!el) return; const hit=label.toLowerCase().includes(q); el.style.display=hit?'':'none'; el.style.outline=hit?'2px solid #f39c12':''; });
    if (!markerMatches.length && !regionMatches.length) return;
    resultsBox = mk('div',{id:container.id==='sb-search-row'?'sb-search-results':'sb-float-results'});
    // Region results first
    regionMatches.slice(0,5).forEach(({name,tier,lat,lng})=>{
      const it=mk('div',{class:'sb-result-item'});
      const tierColour=tier==='region'?'#6e1ac7':tier==='subregion'?'#785a37':'#388e9f';
      it.innerHTML=`<span class="sb-result-dot" style="background:${tierColour}"></span><span>${name}</span><span class="sb-result-cat">${tier}</span>`;
      it.addEventListener('click',()=>{ map.flyTo([lat,lng],0,{animate:true,duration:0.8}); removeResults(); input.value=name; if(clearBtn) clearBtn.style.display=''; if(onResultClick) onResultClick(); });
      resultsBox.appendChild(it);
    });
    markerMatches.slice(0,10).forEach(({label,coords,category})=>{
      const it=mk('div',{class:'sb-result-item'});
      it.innerHTML=`<span class="sb-result-dot" style="background:${COLOURS[category]||'#ffa958'}"></span><span>${label}</span><span class="sb-result-cat">${category}</span>`;
      it.addEventListener('click',()=>{ map.flyTo(coords,0,{animate:true,duration:0.8}); removeResults(); input.value=label; if(clearBtn) clearBtn.style.display=''; if(onResultClick) onResultClick(); });
      resultsBox.appendChild(it);
    });
    container.appendChild(resultsBox);
  }
  input.addEventListener('input',()=>{ const q=input.value.trim().toLowerCase(); if(clearBtn) clearBtn.style.display=q?'':'none'; doSearch(q); });
  input.addEventListener('keydown',e=>{ if(e.key==='Escape'){ input.value=''; if(clearBtn) clearBtn.style.display='none'; clearSearch(layers,savedVis); searchActive=false; removeResults(); } });
  if(clearBtn) clearBtn.addEventListener('click',()=>{ input.value=''; clearBtn.style.display='none'; clearSearch(layers,savedVis); searchActive=false; removeResults(); });
}

// ─── Counts ───────────────────────────────────────────────────────────────────
function updateCounts() {
  Object.keys(categoryRegistry).forEach(cat=>{
    const reg=categoryRegistry[cat];
    const done=reg.markerIds.filter(id=>completedMarkers.has(id)).length;
    const el=document.querySelector(`.sb-cat-count[data-cat="${cat}"]`); if(!el) return;
    el.textContent=`${done}/${reg.total}`;
    el.style.color=done===reg.total&&reg.total>0?'#27ae60':done>0?'#e67e22':'#777';
    el.style.fontWeight=done>0?'bold':'normal';
  });
}

// ─── localStorage ─────────────────────────────────────────────────────────────
function updateLocalStorage() {
  const checked=[]; document.querySelectorAll('#sb-cat-list input[type="checkbox"]').forEach(cb=>{ if(cb.checked) checked.push(cb.dataset.layer); });
  localStorage.setItem('checkedBoxes',JSON.stringify(checked));
}
function loadChecked(layers) {
  const saved=JSON.parse(localStorage.getItem('checkedBoxes'))||[];
  document.querySelectorAll('#sb-cat-list input[type="checkbox"]').forEach(input=>{
    const n=input.dataset.layer;
    if(saved.includes(n)){ input.checked=true; if(!hiddenGroups.has(n)&&layers[n]) map.addLayer(layers[n]); }
    else { input.checked=false; if(layers[n]) map.removeLayer(layers[n]); }
  });
}
function clearSearch(layers, savedVis) {
  document.querySelectorAll('#sb-cat-list input[type="checkbox"]').forEach(cb=>{ const n=cb.dataset.layer; const was=savedVis[n]!==undefined?savedVis[n]:cb.checked; (was&&!hiddenGroups.has(n)&&layers[n])?map.addLayer(layers[n]):layers[n]&&map.removeLayer(layers[n]); });
  allMarkers.forEach(({markerId,marker})=>{ const el=getMarkerEl(marker); if(!el) return; el.style.outline=''; applyCompletedStyle(marker,completedMarkers.has(markerId)); });
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function mk(tag,attrs={}){ const e=document.createElement(tag); Object.entries(attrs).forEach(([k,v])=>k==='class'?(e.className=v):e.setAttribute(k,v)); return e; }
function sep(attrs={}){ const s=mk('span',attrs); s.classList.add('sb-sep'); return s; }
function mkToolBtn(id,svg,tip){ const b=mk('button',{id,class:'sb-tool-btn'}); b.setAttribute('data-tip',tip); b.innerHTML=`${svg}<span class="sb-tool-label">${tip}</span>`; return b; }

loadData();
