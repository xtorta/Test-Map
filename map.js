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
  try { const a = JSON.parse(raw); if (!Array.isArray(a)||!a.length) return; if (!a.every(id => /^.+__\d+$/.test(id))) localStorage.removeItem('completedMarkers'); } catch { localStorage.removeItem('completedMarkers'); }
})();
const completedMarkers = new Set(JSON.parse(localStorage.getItem('completedMarkers')||'[]'));
let hideCompleted = false;
const allMarkers = [];
const categoryRegistry = {};
const hiddenGroups = new Set();
function saveCompleted() { localStorage.setItem('completedMarkers', JSON.stringify([...completedMarkers])); }
function getMarkerId(item, idx) { return `${item.label}__${idx}`; }
const COMPLETABLE = new Set(['Chests','Orb chests','Secret orbs','Recipes','Critters']);

function getMarkerEl(marker) {
  const el = marker.getElement(); if (!el) return null;
  return el.closest ? (el.closest('.leaflet-marker-icon') || el) : el;
}
function applyCompletedStyle(marker, done) {
  const el = getMarkerEl(marker); if (!el) return;
  el.classList.toggle('marker-done', done && !hideCompleted);
  el.classList.toggle('marker-done-hidden', done && hideCompleted);
}
function toggleComplete(mid, marker, category) {
  if (!COMPLETABLE.has(category)) return;
  completedMarkers.has(mid) ? completedMarkers.delete(mid) : completedMarkers.add(mid);
  saveCompleted();
  applyCompletedStyle(marker, completedMarkers.has(mid));
  updateCounts();
}

// ─── Constants ────────────────────────────────────────────────────────────────
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
const FILTER_GROUPS = [
  { key:'npcs',        title:'NPCs',              icon:'👤', cats:['NPCs','Haydn Seek'] },
  { key:'poi',         title:'Points of Interest',icon:'⭐', cats:['Obelisks','Dungeons','Checkpoints'] },
  { key:'collectables',title:'Collectables',      icon:'📦', cats:['Chests','Secret orbs','Orb chests','Recipes','Critters'] },
  { key:'gatherables', title:'Gatherables',       icon:'🌿', cats:['Plants','Ores'], hasSub:true },
  { key:'enemies',     title:'Enemies',           icon:'⚔️', cats:['Mobs','Minibosses','Sparkling mobs'] },
];
const ORE_SUBS   = {
  'Copper':    { labels:['Copper Ore Large','Copper Ore Small'], icon:'./icons/copper.png' },
  'Tin':       { labels:['Tin Ore Large','Tin Ore Small'],       icon:'./icons/tin.png' },
  'Tungstene': { labels:['Tungstene'],                           icon:'./icons/tungstene.png' },
};
const PLANT_SUBS = {
  'Madrigold':    { labels:['Madrigold Large','Madrigold Small'],          icon:'./icons/madrigold.png' },
  'Lavendula':    { labels:['Lavendula Large','Lavendula Small'],          icon:'./icons/lavendula.png' },
  'Ancient Thyme':{ labels:['Ancient Thyme Large','Ancient Thyme Small'],  icon:'./icons/ancientthyme.png' },
  'Zealotus':     { labels:['Zealotus','Zealotus Large','Zealotus Small'], icon:'./icons/zealous.png' },
};
const GATHERABLE_SUBS = { Ores: ORE_SUBS, Plants: PLANT_SUBS };

const SVG = {
  search:  `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="6.5" cy="6.5" r="4"/><line x1="10" y1="10" x2="14" y2="14"/></svg>`,
  eye:     `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>`,
  eyeOff:  `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/><line x1="2" y1="2" x2="14" y2="14"/></svg>`,
  reset:   `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,4 1,1 4,1"/><path d="M1 1 A7 7 0 1 1 1 10"/></svg>`,
  compact: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="1" width="12" height="12" rx="1.5"/><line x1="5" y1="1" x2="5" y2="13"/></svg>`,
  full:    `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="1" width="12" height="12" rx="1.5"/><line x1="1" y1="5" x2="13" y2="5"/></svg>`,
  region:  `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7" cy="7" r="5"/><circle cx="7" cy="7" r="2"/></svg>`,
  sub:     `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="10" height="10" rx="2"/></svg>`,
  zone:    `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="7,1 13,13 1,13"/></svg>`,
  route:   `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M2 12 Q4 5 9 4"/><polyline points="7,2 9,4 7,6" fill="none"/></svg>`,
};

// ─── Region labels ────────────────────────────────────────────────────────────
let regionLabels = [];
let showRegions    = localStorage.getItem('showRegions')    !== '0';
let showSubregions = localStorage.getItem('showSubregions') !== '0';
let showZones      = localStorage.getItem('showZones')      !== '0';
const regionLayer = L.layerGroup().addTo(map);

function getLabelCSS(tier, zoom) {
  const zf = Math.max(0.05, Math.pow(2, zoom));
  const sh = s => Math.max(1, Math.round(s * zf));
  if (tier === 'region') {
    const fs = Math.max(12, Math.round(26*zf));
    return `font-family:Arial,sans-serif;font-size:${fs}px;font-weight:900;color:white;letter-spacing:0.1em;text-transform:uppercase;text-shadow:0 0 ${sh(9)}px rgba(0,0,0,0.95),0 0 ${sh(16)}px rgba(0,0,0,0.8),${sh(2)}px ${sh(2)}px 0 rgba(0,0,0,0.9);pointer-events:none;white-space:nowrap;`;
  } else if (tier === 'subregion') {
    const fs = Math.max(8, Math.round(17*zf));
    return `font-family:Arial,sans-serif;font-size:${fs}px;font-weight:700;font-style:italic;color:rgba(255,255,255,0.95);letter-spacing:0.05em;text-shadow:0 0 ${sh(6)}px rgba(0,0,0,0.95),${sh(1)}px ${sh(1)}px 0 rgba(0,0,0,0.85);pointer-events:none;white-space:nowrap;`;
  } else {
    const fs = Math.max(6, Math.round(12*zf));
    return `font-family:Arial,sans-serif;font-size:${fs}px;font-weight:500;color:rgba(255,255,255,0.88);letter-spacing:0.03em;text-shadow:0 0 ${sh(4)}px rgba(0,0,0,0.95),${sh(1)}px ${sh(1)}px 0 rgba(0,0,0,0.8);pointer-events:none;white-space:nowrap;`;
  }
}
function makeRegionIcon(name, tier) {
  return L.divIcon({ html:`<div style="${getLabelCSS(tier,map.getZoom())}">${name}</div>`, className:'', iconAnchor:[0,0], iconSize:null });
}
function isRegionVisible(tier) { return tier==='region'?showRegions:tier==='subregion'?showSubregions:showZones; }
function refreshRegionVisibility() {
  regionLabels.forEach(({marker,tier}) => {
    if (isRegionVisible(tier)) { if (!regionLayer.hasLayer(marker)) marker.addTo(regionLayer); }
    else regionLayer.removeLayer(marker);
  });
}
map.on('zoomend', () => regionLabels.forEach(({marker,name,tier}) => { if (regionLayer.hasLayer(marker)) marker.setIcon(makeRegionIcon(name,tier)); }));
async function loadRegions() {
  try {
    const r = await fetch('regions.json'); if (!r.ok) return;
    const data = await r.json();
    data.forEach(({name,tier,lat,lng}) => {
      const m = L.marker([lat,lng], { icon:makeRegionIcon(name,tier), interactive:false, keyboard:false, zIndexOffset:tier==='region'?1000:tier==='subregion'?700:500 });
      regionLabels.push({name,tier,lat,lng,marker:m});
      if (isRegionVisible(tier)) m.addTo(regionLayer);
    });
  } catch(e) { console.warn('No regions.json'); }
}

// ─── Custom markers & routes ──────────────────────────────────────────────────
const CUSTOM_ICONS = [
  // Weapons & Combat
  '⚔️','🗡️','🏹','🪃','🔱','🛡️','🪖','💣','🧨',
  // Magic & Items
  '🔮','✨','💫','🌀','🪄','📜','🗝️','🔑','⚗️','🧿',
  // Treasure & Loot
  '💎','💍','🏆','👑','🪙','💰','📦','🎁','🧧',
  // Creatures & Characters
  '💀','☠️','👹','🐉','🦅','🦁','🐺','🕷️','👻',
  // Environment & Navigation
  '🏔️','⛰️','🌋','🏛️','⛩️','🏕️','🚩','📍','🗺️',
  // Status & Utility
  '❗','❓','⚠️','🔥','❄️','⚡','🌊','☁️','🌿','🍄',
];
const CUSTOM_COLOURS = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63','#ff5722','#607d8b','#795548','#ffffff'];

let customMarkers = JSON.parse(localStorage.getItem('customMarkers')||'[]');
let customRoutes  = JSON.parse(localStorage.getItem('customRoutes') ||'[]');
let selectedCustIcon   = localStorage.getItem('custIcon')  || '⚔️';
let selectedCustColour = localStorage.getItem('custColour')|| '#e74c3c';
// ─── Route drawing state ──────────────────────────────────────────────────────
let routeDrawing = false;
let routeDrawActive = false; // mouse is held down drawing
let routePoints  = [];
let routePreviewLayer = null;
let routesVisible = localStorage.getItem('routesVisible') !== '0';

// Convert raw drawn points to smoothed Catmull-Rom curve
function smoothPoints(pts, tension=0.4, steps=8) {
  if (pts.length < 2) return pts;
  if (pts.length === 2) return pts;
  const out = [pts[0]];
  for (let i=0; i<pts.length-1; i++) {
    const p0 = pts[Math.max(0,i-1)];
    const p1 = pts[i];
    const p2 = pts[i+1];
    const p3 = pts[Math.min(pts.length-1,i+2)];
    for (let t=1; t<=steps; t++) {
      const s = t/steps;
      const s2=s*s, s3=s2*s;
      const lat = 0.5*((2*p1[0])+(-p0[0]+p2[0])*s+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*s2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*s3);
      const lng = 0.5*((2*p1[1])+(-p0[1]+p2[1])*s+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*s2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*s3);
      out.push([lat,lng]);
    }
  }
  return out;
}

// Subsample raw points to avoid too many stored points
function subsample(pts, minDist=15) {
  if (!pts.length) return pts;
  const out = [pts[0]];
  for (let i=1;i<pts.length;i++) {
    const last=out[out.length-1];
    const dx=pts[i][1]-last[1], dy=pts[i][0]-last[0];
    if (Math.sqrt(dx*dx+dy*dy)>=minDist) out.push(pts[i]);
  }
  if (out[out.length-1]!==pts[pts.length-1]) out.push(pts[pts.length-1]);
  return out;
}

const custMarkerLayer = L.layerGroup().addTo(map);
const custRouteLayer  = L.layerGroup().addTo(map);

function saveCustom() {
  localStorage.setItem('customMarkers', JSON.stringify(customMarkers.map(({lat,lng,icon,colour,note})=>({lat,lng,icon,colour,note}))));
  localStorage.setItem('customRoutes',  JSON.stringify(customRoutes.map(({points,colour})=>({points,colour}))));
}
function makeCustMarkerIcon(icon, colour) {
  return L.divIcon({ html:`<div style="font-size:1.6em;color:${colour};text-shadow:1px 1px 4px rgba(0,0,0,0.7),0 0 8px rgba(0,0,0,0.5);line-height:1;cursor:pointer;">${icon}</div>`, className:'', iconAnchor:[12,22], iconSize:null });
}
function renderCustomMarkers() {
  custMarkerLayer.clearLayers();
  customMarkers.forEach((cm, i) => {
    const m = L.marker([cm.lat, cm.lng], { icon:makeCustMarkerIcon(cm.icon||'⚔️', cm.colour||'#e74c3c'), draggable:true });
    m.bindPopup(buildCustPopup(cm, i), {maxWidth:200});
    m.on('click', () => openCustPopup(m));
    m.on('dragend', () => { const p=m.getLatLng(); cm.lat=p.lat; cm.lng=p.lng; saveCustom(); });
    m.addTo(custMarkerLayer);
    cm._leaflet = m;
  });
}
function buildCustPopup(cm, i) {
  const div = document.createElement('div');
  div.style.cssText='font-family:Noto,sans-serif;min-width:140px;';
  const noteEl = document.createElement('textarea');
  noteEl.className='cust-popup-note-area';
  noteEl.rows=3; noteEl.value=cm.note||''; noteEl.placeholder='Add a note…';
  noteEl.addEventListener('change', () => { cm.note=noteEl.value; saveCustom(); });
  const delBtn = document.createElement('button');
  delBtn.className='cust-popup-del'; delBtn.textContent='🗑 Delete Marker';
  delBtn.addEventListener('click', () => { customMarkers.splice(i,1); saveCustom(); renderCustomMarkers(); map.closePopup(); });
  div.appendChild(noteEl); div.appendChild(delBtn);
  return div;
}

function openCustPopup(marker) {
  if (isMobile()) {
    const sb  = document.getElementById('sidebar');
    const tog = document.getElementById('sb-toggle');
    if (sb && tog) {
      const w = sb.classList.contains('compact') ? 52 : 290;
      // Always hide sidebar when popup opens on mobile
      sb.style.transform = `translateX(${w}px)`;
      tog.style.right = '0'; tog.innerHTML = '◀';
      // Restore on any popup close
      const restore = () => {
        sb.style.transform = '';
        tog.style.right = w + 'px';
        tog.innerHTML = '▶';
      };
      map.once('popupclose', restore);
    }
  }
  marker.openPopup();
}
function renderRoutes() {
  custRouteLayer.clearLayers();
  if (!routesVisible) { window._routeRenderHook?.(); return; }
  customRoutes.forEach((route, ri) => {
    if (route.points.length < 2) return;
    const raw = route.points.map(p=>[p[0],p[1]]);
    const smooth = smoothPoints(raw);
    const colour = route.colour||'#e74c3c';

    // Draw smooth line
    const line = L.polyline(smooth, { color:colour, weight:3.5, opacity:0.88, smoothFactor:1 });
    line.addTo(custRouteLayer);

    // Place directional arrows along path
    const total = smooth.length;
    const interval = Math.max(8, Math.floor(total * 0.18));
    for (let i = Math.floor(interval/2); i < total - 2; i += interval) {
      const a = smooth[i];
      const b = smooth[Math.min(i + 5, total - 1)];
      // In CRS.Simple: lat=Y(up), lng=X(right)
      // Direction vector: dX = b.lng-a.lng, dY = b.lat-a.lat (but screen Y is inverted)
      // CSS rotate(0deg) = pointing up (north). We want arrow pointing toward b.
      // angle = atan2(dX, dY) gives clockwise rotation from north
      const dX = b[1] - a[1]; // lng diff = horizontal
      const dY = b[0] - a[0]; // lat diff = vertical (in map coords, positive = up)
      const angle = Math.atan2(dX, dY) * 180 / Math.PI;
      const arrowIcon = L.divIcon({
        html: `<div style="transform:rotate(${angle}deg);transform-origin:50% 50%;filter:drop-shadow(0 0 2px rgba(0,0,0,0.8));">
          <svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="8" y1="19" x2="8" y2="1" stroke="${colour}" stroke-width="2.5" stroke-linecap="round"/>
            <polyline points="2,9 8,1 14,9" stroke="${colour}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <polyline points="4,14 8,7 12,14" stroke="${colour}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.65"/>
          </svg>
        </div>`,
        className: '',
        iconAnchor: [8, 10],
        iconSize: [16, 20]
      });
      L.marker([a[0], a[1]], { icon: arrowIcon, interactive: false }).addTo(custRouteLayer);
    }

    // Clickable hit line for popup
    const hitLine = L.polyline(smooth, {color:'transparent', weight:14, opacity:0});
    hitLine.bindPopup(buildRoutePopup(route, ri), {maxWidth:200});
    hitLine.addTo(custRouteLayer);
  });
  window._routeRenderHook?.();
}
function buildRoutePopup(route, ri) {
  const div=document.createElement('div'); div.style.cssText='font-family:Noto,sans-serif;min-width:140px;';
  const label=document.createElement('div'); label.style.cssText='font-size:0.82em;font-weight:700;color:#3a2e1e;margin-bottom:0.4em;'; label.textContent=`Route (${route.points.length} waypoints)`;
  const noteEl=document.createElement('textarea'); noteEl.className='cust-popup-note-area'; noteEl.rows=3; noteEl.value=route.note||''; noteEl.placeholder='Add a note…';
  noteEl.addEventListener('change',()=>{route.note=noteEl.value;saveCustom();});
  const delBtn=document.createElement('button'); delBtn.className='cust-popup-del'; delBtn.textContent='🗑 Delete Route';
  delBtn.addEventListener('click',()=>{customRoutes.splice(ri,1);saveCustom();renderRoutes();map.closePopup();});
  div.appendChild(label); div.appendChild(noteEl); div.appendChild(delBtn);
  return div;
}
function updateRoutePreview() {
  if (routePreviewLayer) map.removeLayer(routePreviewLayer);
  if (routePoints.length >= 2) {
    const smooth = smoothPoints(routePoints);
    routePreviewLayer = L.polyline(smooth, {color:selectedCustColour, weight:3, dashArray:'5 4', opacity:0.8, smoothFactor:1}).addTo(map);
  }
}
function finishRoute() {
  const sub = subsample(routePoints, 12);
  if (sub.length >= 2) { customRoutes.push({points:sub, colour:selectedCustColour, note:''}); saveCustom(); renderRoutes(); }
  routePoints = []; routeDrawActive = false;
  if (routePreviewLayer) { map.removeLayer(routePreviewLayer); routePreviewLayer=null; }
}

// ─── Load & init ──────────────────────────────────────────────────────────────
async function loadData() {
  try { const r=await fetch('assets.json'); if(!r.ok) throw new Error(r.status); initMap(await r.json()); }
  catch(e) { console.error('Failed:', e); }
}
function initMap(data) {
  const layers = {};
  class iconMarker { constructor(f={}){const s=28;this.props={iconUrl:'./icons/mapMarker1.png',iconSize:[s,s],iconAnchor:[s/2,s/2],popupAnchor:[0,-s/2]};for(const[k,v]of Object.entries(f))this.props[k]=v;}}
  class cMarker    { constructor(f={}){this.props={radius:9,fillColor:'#ffa958',color:'#ffffff',weight:1.05,opacity:1,fillOpacity:1};for(const[k,v]of Object.entries(f))this.props[k]=v;}}
  class circleArea { constructor(f={}){this.props={radius:coordToMapScalar*50,fillColor:'#ffa958',color:'#ffffff',weight:1.05,opacity:1,fillOpacity:1};for(const[k,v]of Object.entries(f))this.props[k]=v;}}
  const stylingDict={
    'Misc':new cMarker().props,'Plants':new cMarker({fillColor:'#ee74a3'}).props,
    'Chests':new cMarker({fillColor:'#c68a09',color:'#fffb00'}).props,'Orb chests':new cMarker({fillColor:'#bb5b11',color:'#fffb00'}).props,
    'Ores':new cMarker({fillColor:'#8758d3'}).props,'NPCs':new cMarker({fillColor:'#27ad71'}).props,
    'Haydn Seek':new cMarker({fillColor:'#388e9f'}).props,'Obelisks':new cMarker({fillColor:'#6e1ac7'}).props,
    'Mobs':new cMarker({fillColor:'#d13a3a',radius:8}).props,'Sparkling mobs':new cMarker({fillColor:'#eb19c8'}).props,
    'Dungeons':new cMarker({fillColor:'#430dd8'}).props,'Checkpoints':new cMarker({fillColor:'#4db3db'}).props,
    'Minibosses':new cMarker({fillColor:'#eb681c'}).props,'Critters':new cMarker({fillColor:'#de58ff'}).props,
    'Recipes':new cMarker({fillColor:'#9b7700'}).props,'Secret orbs':new cMarker({fillColor:'#a23030'}).props,
  };
  const iconDict={
    'Obelisks':new iconMarker({iconUrl:'./icons/mapMarker5.png'}).props,'Chests':new iconMarker({iconUrl:'./icons/mapMarker2.png'}).props,
    'Orb chests':new iconMarker({iconUrl:'./icons/mapMarker11.png'}).props,'NPCs':new iconMarker({iconUrl:'./icons/mapMarker8.png'}).props,
    'Dungeons':new iconMarker({iconUrl:'./icons/mapMarker3.png'}).props,'Checkpoints':new iconMarker({iconUrl:'./icons/mapMarker6.png'}).props,
    'Minibosses':new iconMarker({iconUrl:'./icons/mapMarker1.png'}).props,
  };
  const circleDict={
    'Recipes':new circleArea({fillColor:'#9b7700',radius:coordToMapScalar*40,opacity:0.5,fillOpacity:0.5}).props,
    'Secret orbs':new circleArea({fillColor:'#a23030',radius:coordToMapScalar*40,opacity:0.5,fillOpacity:0.5}).props,
    'Haydn Seek':new circleArea({fillColor:'#388e9f',radius:coordToMapScalar*70,opacity:0.5,fillOpacity:0.5}).props,
  };
  data.forEach((item,idx)=>{ const cat=item.categories?.[0]||'Misc'; if(!categoryRegistry[cat]) categoryRegistry[cat]={total:0,markerIds:[],markers:[]}; categoryRegistry[cat].total++; categoryRegistry[cat].markerIds.push(getMarkerId(item,idx)); });

  // Build subtype icon lookup: label → {iconUrl, subKey, mainCat}
  const subTypeMap = {};
  ['Ores','Plants'].forEach(mainCat => {
    const subs = GATHERABLE_SUBS[mainCat];
    Object.entries(subs).forEach(([subKey,{labels,icon}]) => {
      labels.forEach(lbl => { subTypeMap[lbl.toLowerCase()] = {iconUrl:icon, subKey, mainCat}; });
    });
  });

  data.forEach((item,idx)=>{
    const coords=[(s1*(4096-item.y)+b1),s2*(item.x+b2)];
    const cat=item.categories?.[0]||'Misc';
    if (!layers[cat]) layers[cat]=L.layerGroup();
    let m;
    // Check for per-subtype icon
    const subInfo = subTypeMap[item.label.toLowerCase()];
    if (subInfo && subInfo.iconUrl) {
      const sz=28;
      const icon = L.icon({iconUrl:subInfo.iconUrl, iconSize:[sz,sz], iconAnchor:[sz/2,sz/2], popupAnchor:[0,-sz/2]});
      m = L.marker(coords, {icon});
    } else if (cat in iconDict) {
      m = L.marker(coords,{icon:L.icon(iconDict[cat])});
    } else if (cat in circleDict) {
      m = L.circle(coords,circleDict[cat]);
    } else if (cat in stylingDict) {
      m = L.circleMarker(coords,stylingDict[cat]);
    } else {
      m = L.circleMarker(coords,new cMarker().props);
    }
    const mid=getMarkerId(item,idx);
    allMarkers.push({markerId:mid,marker:m,category:cat,label:item.label,coords,subKey:subInfo?.subKey});
    m.bindPopup(`<div style="text-align:center;font-family:Noto,sans-serif;">${item.label}</div>`);
    m.on('contextmenu',e=>{ L.DomEvent.preventDefault(e); L.DomEvent.stopPropagation(e); m.closePopup(); toggleComplete(mid,m,cat); });
    m.on('click',e=>{ if (!isMobile()||routeDrawing) return; toggleComplete(mid,m,cat); });
    m.on('add',()=>setTimeout(()=>applyCompletedStyle(m,completedMarkers.has(mid)),0));
    m.addTo(layers[cat]);
  });

  // Map mouse/touch events for route drawing and marker placement
  const mapEl = map.getContainer();

  // Desktop: mousedown starts drawing, mousemove adds points, mouseup finishes
  mapEl.addEventListener('mousedown', e => {
    if (!routeDrawing || e.button !== 0) return;
    map.dragging.disable();
    routeDrawActive = true;
    routePoints = [];
    const latlng = map.mouseEventToLatLng(e);
    routePoints.push([latlng.lat, latlng.lng]);
  });
  mapEl.addEventListener('mousemove', e => {
    if (!routeDrawing || !routeDrawActive) return;
    const latlng = map.mouseEventToLatLng(e);
    routePoints.push([latlng.lat, latlng.lng]);
    updateRoutePreview();
  });
  mapEl.addEventListener('mouseup', e => {
    if (!routeDrawing || !routeDrawActive || e.button !== 0) return;
    map.dragging.enable();
    finishRoute();
    updateCustModeStatus('Route saved! Hold & drag to draw another');
  });

  // Mobile touch drawing
  mapEl.addEventListener('touchstart', e => {
    if (!routeDrawing) return;
    e.preventDefault();
    routeDrawActive = true; routePoints = [];
    const t = e.touches[0];
    const latlng = map.containerPointToLatLng(L.point(t.clientX - mapEl.getBoundingClientRect().left, t.clientY - mapEl.getBoundingClientRect().top));
    routePoints.push([latlng.lat, latlng.lng]);
  }, {passive:false});
  mapEl.addEventListener('touchmove', e => {
    if (!routeDrawing || !routeDrawActive) return;
    e.preventDefault();
    const t = e.touches[0];
    const rect = mapEl.getBoundingClientRect();
    const latlng = map.containerPointToLatLng(L.point(t.clientX-rect.left, t.clientY-rect.top));
    routePoints.push([latlng.lat, latlng.lng]);
    updateRoutePreview();
  }, {passive:false});
  mapEl.addEventListener('touchend', e => {
    if (!routeDrawing || !routeDrawActive) return;
    e.preventDefault();
    finishRoute();
    updateCustModeStatus('Route saved! Draw another or tap Finish');
  }, {passive:false});

  map.on('click', e => {
    if (routeDrawing) return;
    if (pendingCustPlace) {
      const cm = {lat:e.latlng.lat, lng:e.latlng.lng, icon:selectedCustIcon, colour:selectedCustColour, note:''};
      customMarkers.push(cm);
      saveCustom();
      renderCustomMarkers();
      document.querySelectorAll('.cust-icon-btn.selected').forEach(b=>b.classList.remove('selected'));
      pendingCustPlace = false;
      updateCustModeStatus('Click an icon to select it');
      // openCustPopup handles mobile sidebar hide/restore automatically
      const placed = custMarkerLayer.getLayers().slice(-1)[0];
      if (placed) setTimeout(() => openCustPopup(placed), 50);
    }
  });

  buildSidebar(layers);
  loadChecked(layers);
  updateCounts();
  loadRegions();
  renderCustomMarkers();
  renderRoutes();
}

let pendingCustPlace = false;
function updateCustModeStatus(msg) {
  const el = document.getElementById('cust-mode-status'); if(el) el.textContent=msg;
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
  const isCompact = () => sidebar.classList.contains('compact');

  // ── Header ──────────────────────────────────────────────────────
  const hdr=mk('div',{id:'sb-header'});
  const title=mk('span',{id:'sb-title'}); title.textContent='Farever Map';
  const viewBtns=mk('div',{id:'sb-view-btns'});
  const btnTV=mk('button',{id:'sb-btn-toggle-view',class:'sb-view-btn'});
  const updateViewBtn=()=>{ btnTV.innerHTML=isCompact()?SVG.full:SVG.compact; btnTV.setAttribute('data-tip',isCompact()?'Expand':'Compact'); };
  updateViewBtn();
  viewBtns.appendChild(btnTV);
  hdr.appendChild(title); hdr.appendChild(viewBtns);
  sidebar.appendChild(hdr);
  sidebar.appendChild(sep({id:'sb-sep-first'}));

  // ── About ────────────────────────────────────────────────────────
  const aboutRow=mk('div',{id:'sb-about-row'});
  aboutRow.innerHTML=`<span>ℹ️ About</span><span id="sb-about-chevron">${aboutOpen?'▲':'▼'}</span>`;
  const aboutPanel=mk('div',{id:'sb-about-panel'});
  aboutPanel.style.display=aboutOpen?'block':'none';
  aboutPanel.innerHTML=`Welcome to the Farever interactive map by the <a href="https://farever.wiki" target="_blank">Farever Wiki</a> team.<br><br>Data pulled from the game. Feedback: <strong>@IceCaveBear</strong> on Discord.`;
  aboutRow.addEventListener('click',()=>{ const o=aboutPanel.style.display==='block'; aboutPanel.style.display=o?'none':'block'; document.getElementById('sb-about-chevron').textContent=o?'▼':'▲'; localStorage.setItem('sbAboutOpen',o?'0':'1'); });
  sidebar.appendChild(aboutRow);
  sidebar.appendChild(aboutPanel);
  sidebar.appendChild(sep({id:'sb-sep-about'}));

  // ── Search (above tabs) ──────────────────────────────────────────
  const searchRow=mk('div',{id:'sb-search-row'});
  searchRow.innerHTML=`<input id="sb-search" type="text" placeholder="🔍 Search markers & regions…" autocomplete="off"><button id="sb-search-clear" style="display:none">✕</button>`;
  sidebar.appendChild(searchRow);
  sidebar.appendChild(sep());

  // ── Tabs: Filter / Custom ────────────────────────────────────────
  const tabBar=mk('div',{id:'sb-tabs'});
  [{key:'filter',label:'🔍 Filter'},{key:'custom',label:'📍 Custom'}].forEach((t,i)=>{
    const btn=mk('button',{class:'sb-tab'+(i===0?' active':'')}); btn.dataset.tab=t.key; btn.textContent=t.label;
    btn.addEventListener('click',()=>{
      tabBar.querySelectorAll('.sb-tab').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
      document.getElementById('sb-panel-filter')?.classList.toggle('active',t.key==='filter');
      document.getElementById('sb-panel-custom')?.classList.toggle('active',t.key==='custom');
    });
    tabBar.appendChild(btn);
  });
  sidebar.appendChild(tabBar);

  // ── Tool buttons (hide / reset) ──────────────────────────────────
  const iconTools=mk('div',{id:'sb-icon-tools'});
  const searchToolBtn=mkToolBtn('sb-search-tool',SVG.search,'Search'); searchToolBtn.classList.add('compact-only');
  const hideBtn=mkToolBtn('sb-hide-btn',SVG.eye,'Hide Completed');
  const resetBtn=mkToolBtn('sb-reset-btn',SVG.reset,'Reset Completed');
  iconTools.appendChild(searchToolBtn); iconTools.appendChild(hideBtn); iconTools.appendChild(resetBtn);
  sidebar.appendChild(iconTools);
  sidebar.appendChild(sep());

  // ── Zone toggles ─────────────────────────────────────────────────
  const zoneTogs=mk('div',{id:'sb-zone-toggles'});
  [{key:'region',svg:SVG.region,label:'Regions',id:'ztog-region',tip:'Toggle Regions'},{key:'subregion',svg:SVG.sub,label:'Sub',id:'ztog-subregion',tip:'Toggle Sub-regions'},{key:'zone',svg:SVG.zone,label:'Zones',id:'ztog-zone',tip:'Toggle Zones'}].forEach(({key,svg,label,id,tip})=>{
    const btn=mk('button',{class:'zone-tog-btn'+(isRegionVisible(key)?' active':''),id});
    btn.setAttribute('data-tip',tip);
    btn.innerHTML=`${svg}<span class="ztog-label">${label}</span>`;
    btn.addEventListener('click',()=>{
      if(key==='region'){showRegions=!showRegions;localStorage.setItem('showRegions',showRegions?'1':'0');}
      else if(key==='subregion'){showSubregions=!showSubregions;localStorage.setItem('showSubregions',showSubregions?'1':'0');}
      else{showZones=!showZones;localStorage.setItem('showZones',showZones?'1':'0');}
      btn.classList.toggle('active',isRegionVisible(key));
      refreshRegionVisibility();
    });
    zoneTogs.appendChild(btn);
  });
  sidebar.appendChild(zoneTogs);
  sidebar.appendChild(sep());

  // ── Panel: Filter ────────────────────────────────────────────────
  const filterPanel=mk('div',{id:'sb-panel-filter',class:'sb-panel active'});

  const catList=mk('div',{id:'sb-cat-list'});
  FILTER_GROUPS.forEach(group => {
    const groupDiv=mk('div',{class:'filter-group'});
    const groupCollapsed=localStorage.getItem(`fg_${group.key}`)==='1';
    if(groupCollapsed) groupDiv.classList.add('collapsed');

    // Group header
    const ghdr=mk('div',{class:'filter-group-header'});
    const eyeBtn=mk('button',{class:'fgh-eye'}); eyeBtn.innerHTML=SVG.eye;
    eyeBtn.addEventListener('click',e=>{ e.stopPropagation(); toggleGroupVisibility(group, layers, eyeBtn); });
    ghdr.innerHTML=`<div class="fgh-left"><span>${group.icon}</span><span class="fgh-title">${group.title}</span></div><div style="display:flex;align-items:center;gap:0.4em"></div>`;
    ghdr.querySelector('div:last-child').prepend(eyeBtn);
    const chev=mk('span',{class:'fgh-chevron'}); chev.textContent='▼';
    ghdr.querySelector('div:last-child').appendChild(chev);
    ghdr.addEventListener('click',e=>{ if(e.target.closest('.fgh-eye')) return; groupDiv.classList.toggle('collapsed'); localStorage.setItem(`fg_${group.key}`,groupDiv.classList.contains('collapsed')?'1':'0'); });

    const groupRows=mk('div',{class:'filter-group-rows'});

    if (group.hasSub) {
      ['Plants','Ores'].forEach(mainCat => {
        const subs=mainCat==='Plants'?PLANT_SUBS:ORE_SUBS;
        const colour=COLOURS[mainCat]||'#ffa958';
        const subDiv=mk('div',{class:'filter-subgroup'});
        const subCollapsed=localStorage.getItem(`fsg_${mainCat}`)==='1';
        if(subCollapsed) subDiv.classList.add('collapsed');
        const shdr=mk('div',{class:'filter-subgroup-header'});
        shdr.innerHTML=`<span class="fsh-title" style="color:${colour}">${mainCat}</span><span class="fsh-chevron">▼</span>`;
        shdr.addEventListener('click',()=>{ subDiv.classList.toggle('collapsed'); localStorage.setItem(`fsg_${mainCat}`,subDiv.classList.contains('collapsed')?'1':'0'); });
        subDiv.appendChild(shdr);
        const subRows=mk('div',{class:'filter-subgroup-rows'});
        // All sub-type markers still live in layers[mainCat], so parent checkbox controls all
        // Keep the parent row for show/hide all of this type
        // Sub-label highlight rows — stacking: multiple selections show union
        const activeSubs = new Set();
        function applySubFilter() {
          allMarkers.forEach(({label,marker,category,subKey})=>{
            if(category!==mainCat) return;
            const el=getMarkerEl(marker); if(!el) return;
            if(activeSubs.size===0){
              el.style.display=''; el.style.opacity='';
              applyCompletedStyle(marker,completedMarkers.has(allMarkers.find(m=>m.marker===marker)?.markerId));
            } else {
              const match = activeSubs.has(subKey);
              el.style.display = match ? '' : 'none';
              if(match) el.style.opacity='';
            }
          });
        }
        Object.entries(subs).forEach(([subName,{labels,icon}])=>{
          const subRow=mk('div',{class:'sublabel-row'}); subRow.dataset.sublabel=subName;
          const eyeEl=mk('span',{class:'sublabel-eye'}); eyeEl.innerHTML=SVG.eye;
          const iconEl=mk('img'); iconEl.src=icon; iconEl.className='sublabel-icon'; iconEl.alt=subName;
          const nameEl=mk('span',{class:'sublabel-name'}); nameEl.textContent=subName;
          subRow.appendChild(eyeEl);
          subRow.appendChild(iconEl);
          subRow.appendChild(nameEl);
          subRow.addEventListener('click',()=>{
            if(activeSubs.has(subName)) { activeSubs.delete(subName); subRow.classList.remove('active'); eyeEl.innerHTML=SVG.eye; }
            else { activeSubs.add(subName); subRow.classList.add('active'); eyeEl.innerHTML=SVG.eyeOff; }
            applySubFilter();
          });
          subRows.appendChild(subRow);
        });
        subDiv.appendChild(subRows);
        groupRows.appendChild(subDiv);
      });
    } else {
      group.cats.forEach(cat => { if (layers[cat]) groupRows.appendChild(buildCatRow(cat, layers)); });
    }
    groupDiv.appendChild(ghdr); groupDiv.appendChild(groupRows);
    catList.appendChild(groupDiv);
  });

  // Scroll indicators
  const scrollUp=mk('div',{id:'sb-scroll-up'}); scrollUp.innerHTML=`<svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,7 6,1 11,7"/></svg>`;
  const scrollDn=mk('div',{id:'sb-scroll-down'}); scrollDn.innerHTML=`<svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,1 6,7 11,1"/></svg>`;
  const updateScrollInds=()=>{ scrollUp.style.display=catList.scrollTop>8?'flex':'none'; scrollDn.style.display=(catList.scrollHeight-catList.scrollTop-catList.clientHeight)>8?'flex':'none'; };
  catList.addEventListener('scroll',updateScrollInds);
  btnTV.addEventListener('click',()=>setTimeout(updateScrollInds,300));
  requestAnimationFrame(()=>setTimeout(updateScrollInds,50));
  window.addEventListener('resize',updateScrollInds);

  filterPanel.appendChild(scrollUp);
  filterPanel.appendChild(catList);
  filterPanel.appendChild(scrollDn);
  sidebar.appendChild(filterPanel);

  // ── Compact list (icon-only, all cats) ───────────────────────────
  const compactList=mk('div',{id:'sb-compact-list'});
  let prevGroup='';
  FILTER_GROUPS.forEach(group=>{
    if (group.key==='zones') return;
    if (prevGroup && prevGroup!==group.key) { compactList.appendChild(mk('span',{class:'compact-cat-sep'})); }
    const cats=group.hasSub?['Plants','Ores']:group.cats;
    cats.forEach(cat=>{
      if (!layers[cat]) return;
      const colour=COLOURS[cat]||'#ffa958';
      const iconUrl=ICONS[cat];
      const row=mk('label',{class:'compact-cat-row'}); row.setAttribute('data-tip',cat);
      const indicator=iconUrl?`<img src="${iconUrl}" class="sb-cat-icon" alt="">`:
        `<span class="sb-cat-dot-wrap"><span class="sb-cat-dot" style="background:${colour}"></span></span>`;
      const savedChecked=(JSON.parse(localStorage.getItem('checkedBoxes'))||[]).includes(cat);
      if(savedChecked) row.classList.add('checked');
      row.innerHTML=`<input type="checkbox" data-layer="${cat}" class="cat-compact" style="display:none"${savedChecked?' checked':''}>${indicator}`;
      row.querySelector('input').addEventListener('change',e=>{
        const n=e.target.dataset.layer;
        if(!hiddenGroups.has(n)){ e.target.checked?map.addLayer(layers[n]):map.removeLayer(layers[n]); }
        row.classList.toggle('checked',e.target.checked);
        updateLocalStorage();
      });
      compactList.appendChild(row);
    });
    prevGroup=group.key;
  });
  sidebar.appendChild(compactList);

  // ── Panel: Custom ────────────────────────────────────────────────
  const customPanel=mk('div',{id:'sb-panel-custom',class:'sb-panel'});
  buildCustomPanel(customPanel);
  sidebar.appendChild(customPanel);

  // ── Hint ─────────────────────────────────────────────────────────
  sidebar.appendChild(sep({id:'sb-sep-hint'}));
  const hint=mk('div',{id:'sb-hint'});
  const updateHint=()=>{ hint.innerHTML=isMobile()?`<span class="sb-hint-icon">👆</span><span class="sb-hint-text"><strong>Tap</strong> a collectable marker to mark it complete</span>`:`<span class="sb-hint-icon">🖱️</span><span class="sb-hint-text"><strong>Right-click</strong> a collectable to mark it complete</span>`; };
  updateHint(); window.addEventListener('resize',updateHint);
  sidebar.appendChild(hint);
  document.body.appendChild(sidebar);

  // ── Toggle arrow ─────────────────────────────────────────────────
  const toggle=mk('button',{id:'sb-toggle'});
  document.body.appendChild(toggle);

  // ── Floating search (sidebar closed) ────────────────────────────
  const floatWrap=mk('div',{id:'sb-search-float'});
  const floatBtn=mk('button',{id:'sb-search-float-btn'}); floatBtn.innerHTML=SVG.search;
  const floatInputWrap=mk('div',{id:'sb-float-input-wrap'});
  const floatInput=mk('input'); Object.assign(floatInput,{type:'text',placeholder:'Search…',id:'sb-float-input',autocomplete:'off'});
  const floatClose=mk('button',{id:'sb-float-close'}); floatClose.innerHTML=`<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>`;
  floatInputWrap.appendChild(floatInput); floatInputWrap.appendChild(floatClose);
  floatWrap.appendChild(floatBtn); floatWrap.appendChild(floatInputWrap);
  document.body.appendChild(floatWrap);
  let floatOpen=false;
  floatBtn.addEventListener('click',()=>{ floatOpen=!floatOpen; floatInputWrap.style.display=floatOpen?'flex':'none'; floatBtn.classList.toggle('active',floatOpen); if(floatOpen) setTimeout(()=>floatInput.focus(),50); else {floatInput.value=''; clearSearch(layers,{});} });
  floatClose.addEventListener('click',()=>{ floatOpen=false; floatInputWrap.style.display='none'; floatBtn.classList.remove('active'); floatInput.value=''; loadChecked(layers); clearSearch(layers,{}); });
  wireSearch(floatInput,null,floatInputWrap,layers,null);

  // ── Compact search popup ─────────────────────────────────────────
  searchToolBtn.addEventListener('click',()=>{
    let existing=document.getElementById('sb-compact-search-popup');
    if(existing){existing.remove();return;}
    const sb=document.getElementById('sidebar');
    const sbRect=sb?.getBoundingClientRect();
    const btnRect=searchToolBtn.getBoundingClientRect();
    const popup=mk('div',{id:'sb-compact-search-popup'});
    popup.style.cssText=`position:fixed;top:${btnRect.top}px;right:${window.innerWidth-sbRect.left+8}px;z-index:1200;display:flex;align-items:center;background:rgb(232,228,218);border:1.5px solid #a09880;border-radius:6px;padding:0.35em 0.5em;gap:0.3em;box-shadow:0 3px 10px rgba(0,0,0,0.25);`;
    const inp=mk('input'); Object.assign(inp,{type:'text',placeholder:'Search…',autocomplete:'off',style:'background:transparent;border:none;font-family:Noto,sans-serif;font-size:0.9em;color:#1a1a1a;outline:none;width:190px;'});
    const cls=mk('button'); cls.innerHTML=`<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>`; cls.style.cssText='background:none;border:none;cursor:pointer;color:#777;padding:0.1em;display:flex;align-items:center;';
    popup.appendChild(inp); popup.appendChild(cls);
    document.body.appendChild(popup);
    setTimeout(()=>inp.focus(),50);
    cls.addEventListener('click',()=>{popup.remove(); loadChecked(layers); clearSearch(layers,{});});
    wireSearch(inp,null,popup,layers,null);
  });

  // ── JS tooltip for compact list ──────────────────────────────────
  const sbTip=mk('div',{id:'sb-tooltip'});
  sbTip.style.cssText='position:fixed;background:rgba(0,0,0,0.85);color:white;font-size:0.88em;font-weight:600;padding:0.35em 0.65em;border-radius:4px;pointer-events:none;z-index:2000;display:none;white-space:nowrap;';
  document.body.appendChild(sbTip);
  function attachTip(el){
    el.addEventListener('mouseover',e=>{ const row=e.target.closest('[data-tip]'); if(!row||!isCompact()) return; sbTip.textContent=row.getAttribute('data-tip'); sbTip.style.display='block'; });
    el.addEventListener('mousemove',e=>{ const row=e.target.closest('[data-tip]'); if(!row||!isCompact()){sbTip.style.display='none';return;} const r=row.getBoundingClientRect(); sbTip.style.top=(r.top+r.height/2-sbTip.offsetHeight/2)+'px'; sbTip.style.left=(r.left-sbTip.offsetWidth-10)+'px'; });
    el.addEventListener('mouseleave',()=>sbTip.style.display='none');
  }
  attachTip(compactList); attachTip(iconTools); attachTip(zoneTogs);

  // ── Layout & state ───────────────────────────────────────────────
  let sidebarOpen=savedView!=='closed';
  function curW(){return isCompact()?(isMobile()?52:52):(isMobile()?290:320);}
  function saveView(){localStorage.setItem('sbView',!sidebarOpen?'closed':isCompact()?'compact':'full');}
  function applyLayout(animate){
    if(!animate){sidebar.style.transition='none';toggle.style.transition='none';}
    const w=curW();
    sidebar.style.transform=sidebarOpen?'':(`translateX(${w}px)`);
    toggle.style.right=sidebarOpen?w+'px':'0';
    toggle.innerHTML=sidebarOpen?'▶':'◀';
    floatWrap.style.display=sidebarOpen?'none':'flex';
    if(!animate)requestAnimationFrame(()=>{sidebar.style.transition='';toggle.style.transition='';});
  }
  toggle.addEventListener('click',()=>{sidebarOpen=!sidebarOpen;saveView();applyLayout(true);});
  btnTV.addEventListener('click',()=>{sidebar.classList.toggle('compact');updateViewBtn();saveView();applyLayout(true);});
  applyLayout(false);
  window.addEventListener('resize',()=>applyLayout(false));

  // ── Checkboxes (full filter panel) ──────────────────────────────
  document.querySelectorAll('#sb-cat-list input[type="checkbox"]').forEach(cb=>{
    cb.addEventListener('change',e=>{ const n=e.target.dataset.layer; if(!hiddenGroups.has(n)){e.target.checked?map.addLayer(layers[n]):map.removeLayer(layers[n]);} updateLocalStorage(); });
  });

  // ── Search ───────────────────────────────────────────────────────
  wireSearch(document.getElementById('sb-search'),document.getElementById('sb-search-clear'),document.getElementById('sb-search-row'),layers,()=>{if(isMobile()){sidebarOpen=false;saveView();applyLayout(true);}});

  // ── Hide completed ───────────────────────────────────────────────
  hideBtn.addEventListener('click',()=>{
    hideCompleted=!hideCompleted; hideBtn.classList.toggle('active',hideCompleted);
    hideBtn.innerHTML=`${hideCompleted?SVG.eyeOff:SVG.eye}<span class="sb-tool-label">${hideCompleted?'Show Completed':'Hide Completed'}</span>`;
    hideBtn.setAttribute('data-tip',hideCompleted?'Show Completed':'Hide Completed');
    allMarkers.forEach(({markerId,marker})=>applyCompletedStyle(marker,completedMarkers.has(markerId)));
  });

  // ── Reset completed ──────────────────────────────────────────────
  resetBtn.addEventListener('click',()=>{
    if(!completedMarkers.size) return;
    if(!confirm(`Reset all ${completedMarkers.size} completed marker(s)?`)) return;
    completedMarkers.clear(); saveCompleted();
    allMarkers.forEach(({marker})=>{ const el=getMarkerEl(marker); if(!el) return; el.classList.remove('marker-done','marker-done-hidden'); });
    updateCounts();
  });
}

// ─── Group show/hide ──────────────────────────────────────────────────────────
function toggleGroupVisibility(group, layers, eyeBtn) {
  const allCats = group.hasSub ? ['Plants','Ores'] : group.cats;
  const nowHiding = !eyeBtn.classList.contains('hidden-state');
  eyeBtn.classList.toggle('hidden-state', nowHiding);
  eyeBtn.innerHTML = nowHiding ? SVG.eyeOff : SVG.eye;
  allCats.forEach(cat => {
    if (nowHiding) {
      hiddenGroups.add(cat);
      if (layers[cat]) map.removeLayer(layers[cat]);
      document.querySelectorAll(`input[data-layer="${cat}"]`).forEach(cb=>{ cb.checked=false; cb.closest('.compact-cat-row')?.classList.remove('checked'); });
    } else {
      hiddenGroups.delete(cat);
      // Check all and add all layers
      document.querySelectorAll(`input[data-layer="${cat}"]`).forEach(cb=>{ cb.checked=true; cb.closest('.compact-cat-row')?.classList.add('checked'); });
      if (layers[cat]) map.addLayer(layers[cat]);
    }
  });
  updateLocalStorage();
}

// ─── Route share codes ────────────────────────────────────────────────────────
function encodeRouteCode(route) {
  // Compact: colour (3 hex digits) + point count + lat/lng pairs rounded to 1dp
  const c = route.colour||'#e74c3c';
  const hex6 = c.replace('#','');
  // Convert to 3-char hex
  const r3 = Math.round(parseInt(hex6.slice(0,2),16)/17).toString(16);
  const g3 = Math.round(parseInt(hex6.slice(2,4),16)/17).toString(16);
  const b3 = Math.round(parseInt(hex6.slice(4,6),16)/17).toString(16);
  const colCode = r3+g3+b3;
  const pts = route.points.map(p=>`${Math.round(p[0]*10)},${Math.round(p[1]*10)}`).join(';');
  const note = (route.note||'').replace(/[^a-zA-Z0-9 ]/g,'').slice(0,30);
  const raw = `${colCode}|${pts}|${note}`;
  return btoa(raw).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}
function decodeRouteCode(code) {
  try {
    const padded = code.replace(/-/g,'+').replace(/_/g,'/');
    const raw = atob(padded + '=='.slice(0,(4-padded.length%4)%4));
    const [colCode, ptsStr, note=''] = raw.split('|');
    // Expand 3-char hex to 6
    const r=parseInt(colCode[0],16)*17, g=parseInt(colCode[1],16)*17, b=parseInt(colCode[2],16)*17;
    const colour = '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
    const points = ptsStr.split(';').map(s=>{ const [a,b2]=s.split(','); return [parseFloat(a)/10,parseFloat(b2)/10]; });
    if (points.length<2) return null;
    return {colour, points, note};
  } catch { return null; }
}

function buildCustomPanel(panel) {
  panel.innerHTML='';

  const statusEl=mk('div',{class:'cust-mode-status',id:'cust-mode-status'}); statusEl.textContent='Select an icon to place on the map';

  // Icon grid
  const iconTitle=mk('div',{class:'cust-section-title'}); iconTitle.textContent='Icon';
  const iconGrid=mk('div',{class:'cust-icon-grid'});
  let selIconBtn=null;
  CUSTOM_ICONS.forEach(ic=>{
    const b=mk('div',{class:'cust-icon-btn'}); b.textContent=ic;
    b.addEventListener('click',()=>{
      if(selIconBtn===b && pendingCustPlace){ // clicking selected icon cancels
        pendingCustPlace=false; b.classList.remove('selected'); selIconBtn=null;
        updateCustModeStatus('Click an icon to select it');
        return;
      }
      selectedCustIcon=ic; localStorage.setItem('custIcon',ic);
      selIconBtn?.classList.remove('selected'); b.classList.add('selected'); selIconBtn=b;
      pendingCustPlace=true; updateCustModeStatus(`Click map to place ${ic} — click icon again to cancel`);
    });
    iconGrid.appendChild(b);
  });

  // Route drawing
  const routeTitle=mk('div',{class:'cust-section-title'}); routeTitle.textContent='Routes';
  const routeInstructions=mk('div',{class:'cust-route-instructions'}); routeInstructions.textContent='Click "Draw Route" then click the map to add waypoints. Click a route on the map to edit/delete.';
  const modeRow=mk('div',{class:'cust-mode-row'});
  const btnRoute=mk('button',{class:'cust-btn cust-btn-route'}); btnRoute.innerHTML=`${SVG.route} Draw Route`;
  const btnFinish=mk('button',{class:'cust-btn cust-btn-route',style:'display:none'}); btnFinish.textContent='✓ Finish';
  const btnCancel=mk('button',{class:'cust-btn cust-btn-cancel',style:'display:none'}); btnCancel.textContent='✕ Cancel';
  modeRow.appendChild(btnRoute); modeRow.appendChild(btnFinish); modeRow.appendChild(btnCancel);

  const routeVisRow=mk('div',{class:'cust-mode-row',style:'margin-top:0.3em;'});
  const btnToggleRoutes=mk('button',{class:`cust-btn cust-btn-route${routesVisible?' active':''}`});
  btnToggleRoutes.textContent=routesVisible?'👁 Routes Visible':'👁 Routes Hidden';
  btnToggleRoutes.style.flex='1';
  btnToggleRoutes.addEventListener('click',()=>{
    routesVisible=!routesVisible; localStorage.setItem('routesVisible',routesVisible?'1':'0');
    btnToggleRoutes.classList.toggle('active',routesVisible);
    btnToggleRoutes.textContent=routesVisible?'👁 Routes Visible':'👁 Routes Hidden';
    renderRoutes();
  });
  routeVisRow.appendChild(btnToggleRoutes);
  btnRoute.addEventListener('click',()=>{
    routeDrawing=true; pendingCustPlace=false;
    btnRoute.style.display='none'; btnFinish.style.display=''; btnCancel.style.display='';
    updateCustModeStatus('Hold and drag on the map to draw a route');
    if(isMobile()) showMobileRouteBar(btnFinish, btnCancel, btnRoute);
  });
  btnFinish.addEventListener('click',()=>{
    finishRoute(); routeDrawing=false;
    btnRoute.style.display=''; btnFinish.style.display='none'; btnCancel.style.display='none';
    updateCustModeStatus('Route saved');
    hideMobileRouteBar(true);
  });
  btnCancel.addEventListener('click',()=>{
    routeDrawing=false; routePoints=[]; routeDrawActive=false;
    if(routePreviewLayer){map.removeLayer(routePreviewLayer);routePreviewLayer=null;}
    btnRoute.style.display=''; btnFinish.style.display='none'; btnCancel.style.display='none';
    updateCustModeStatus('');
    hideMobileRouteBar(true);
  });

  // Colour picker
  const colTitle=mk('div',{class:'cust-section-title'}); colTitle.textContent='Colour';
  const colRow=mk('div',{class:'color-swatch-row'});
  let selColSwatch=null;
  CUSTOM_COLOURS.forEach(col=>{
    const s=mk('div',{class:'color-swatch'+(col===selectedCustColour?' selected':'')}); s.style.background=col;
    s.addEventListener('click',()=>{ selectedCustColour=col; localStorage.setItem('custColour',col); selColSwatch?.classList.remove('selected'); s.classList.add('selected'); selColSwatch=s; });
    if(col===selectedCustColour) selColSwatch=s;
    colRow.appendChild(s);
  });

  // Route share
  const shareTitle=mk('div',{class:'cust-section-title'}); shareTitle.textContent='Share Routes';
  const shareWrap=mk('div',{style:'display:flex;flex-direction:column;gap:0.4em;'});

  // Export: pick a route to share
  const exportLabel=mk('div',{style:'font-size:0.74em;color:#5a4a2a;'}); exportLabel.textContent='Copy code for a route:';
  const exportSelect=mk('select',{style:'width:100%;padding:0.35em 0.5em;border:1.5px solid #a09880;border-radius:4px;font-family:Noto,sans-serif;font-size:0.82em;background:rgb(232,228,218);color:#1a1a1a;outline:none;'});
  const exportCodeBox=mk('input'); Object.assign(exportCodeBox,{type:'text',readOnly:true,placeholder:'Select a route above',style:'width:100%;padding:0.32em 0.5em;border:1.5px solid #a09880;border-radius:4px;font-family:Noto,sans-serif;font-size:0.74em;background:rgb(225,220,210);color:#1a1a1a;outline:none;cursor:pointer;'});
  exportCodeBox.title='Click to copy';
  exportCodeBox.addEventListener('click',()=>{ if(exportCodeBox.value&&exportCodeBox.value!=='No routes yet'){ navigator.clipboard?.writeText(exportCodeBox.value).then(()=>{exportCodeBox.style.background='rgb(200,230,200)';setTimeout(()=>exportCodeBox.style.background='',1000);}); } });

  function refreshExportSelect() {
    exportSelect.innerHTML='';
    if (!customRoutes.length) { const o=mk('option'); o.textContent='No routes'; exportSelect.appendChild(o); exportCodeBox.value='No routes yet'; return; }
    customRoutes.forEach((rt,i)=>{
      const o=mk('option'); o.value=i; o.textContent=`Route ${i+1}${rt.note?' — '+rt.note.slice(0,20):''}  (${rt.points.length} pts)`;
      exportSelect.appendChild(o);
    });
    exportSelect.dispatchEvent(new Event('change'));
  }
  exportSelect.addEventListener('change',()=>{ const rt=customRoutes[+exportSelect.value]; if(rt) exportCodeBox.value=encodeRouteCode(rt); });

  // Import
  const importLabel=mk('div',{style:'font-size:0.74em;color:#5a4a2a;margin-top:0.2em;'}); importLabel.textContent='Import a shared code:';
  const importRow=mk('div',{style:'display:flex;gap:0.3em;'});
  const importInput=mk('input'); Object.assign(importInput,{type:'text',placeholder:'Paste code here…',style:'flex:1;padding:0.32em 0.5em;border:1.5px solid #a09880;border-radius:4px;font-family:Noto,sans-serif;font-size:0.8em;background:rgb(232,228,218);color:#1a1a1a;outline:none;'});
  const importBtn=mk('button',{style:'padding:0.32em 0.7em;border-radius:4px;border:none;background:rgb(120,90,55);color:white;font-family:Noto,sans-serif;font-size:0.78em;font-weight:700;cursor:pointer;white-space:nowrap;'}); importBtn.textContent='Import';
  const importStatus=mk('div',{style:'font-size:0.72em;min-height:1em;color:#5a4a2a;'});
  importBtn.addEventListener('click',()=>{
    const rt=decodeRouteCode(importInput.value.trim());
    if (!rt) { importStatus.textContent='❌ Invalid code'; importStatus.style.color='#c0392b'; return; }
    customRoutes.push(rt); saveCustom(); renderRoutes(); refreshExportSelect();
    importInput.value=''; importStatus.textContent='✓ Route imported!'; importStatus.style.color='#27ae60';
    setTimeout(()=>importStatus.textContent='',3000);
  });
  importRow.appendChild(importInput); importRow.appendChild(importBtn);

  shareWrap.appendChild(exportLabel); shareWrap.appendChild(exportSelect);
  shareWrap.appendChild(exportCodeBox); shareWrap.appendChild(importLabel);
  shareWrap.appendChild(importRow); shareWrap.appendChild(importStatus);

  // Refresh export list when routes change
  const origRenderRoutes = window._routeRenderHook;
  window._routeRenderHook = () => { refreshExportSelect(); };

  panel.appendChild(statusEl);
  panel.appendChild(iconTitle); panel.appendChild(iconGrid);
  panel.appendChild(sep());
  panel.appendChild(routeTitle); panel.appendChild(routeInstructions);
  panel.appendChild(modeRow); panel.appendChild(routeVisRow);
  panel.appendChild(sep());
  panel.appendChild(colTitle); panel.appendChild(colRow);
  panel.appendChild(sep());
  panel.appendChild(shareTitle); panel.appendChild(shareWrap);

  refreshExportSelect();
}

// ─── Build category row ───────────────────────────────────────────────────────
function buildCatRow(name, layers) {
  const colour=COLOURS[name]||'#ffa958', iconUrl=ICONS[name], total=categoryRegistry[name]?.total||0;
  const row=mk('label',{class:'sb-cat-row'}); row.setAttribute('data-tip',name);
  const indicator=iconUrl?`<img src="${iconUrl}" class="sb-cat-icon" alt="">`:
    `<span class="sb-cat-dot-wrap"><span class="sb-cat-dot" style="background:${colour}"></span></span>`;
  row.innerHTML=`<input type="checkbox" data-layer="${name}" class="category" style="display:none"><span class="sb-check-img"></span>${indicator}<span class="sb-cat-name" style="color:${colour}">${name}</span><span class="sb-cat-count" data-cat="${name}">0/${total}</span>`;
  return row;
}

// ─── Search wiring ────────────────────────────────────────────────────────────
function wireSearch(input, clearBtn, container, layers, onResultClick) {
  let searchActive=false, savedVis={}, resultsId=container.id==='sb-search-row'?'sb-search-results':'sb-float-results';
  function removeResults(){document.getElementById(resultsId)?.remove();}
  function doSearch(q) {
    removeResults(); if(!q){clearSearch(layers,savedVis);searchActive=false;return;}
    if(!searchActive){document.querySelectorAll('#sb-cat-list input[type="checkbox"]').forEach(cb=>savedVis[cb.dataset.layer]=cb.checked);searchActive=true;}

    const regionMatches=regionLabels.filter(({name})=>name.toLowerCase().includes(q));
    const markerMatches=allMarkers.filter(({label})=>label.toLowerCase().includes(q));

    // Only filter marker visibility if there are marker results — region results don't affect markers
    if(markerMatches.length>0){
      Object.keys(layers).forEach(n=>map.addLayer(layers[n]));
      allMarkers.forEach(({label,marker})=>{ const el=getMarkerEl(marker); if(!el) return; const hit=label.toLowerCase().includes(q); el.style.display=hit?'':'none'; el.style.outline=hit?'2px solid #f39c12':''; });
    } else {
      // Region-only results: restore all markers to saved visibility, don't hide anything
      clearSearch(layers, savedVis);
    }

    if(!markerMatches.length&&!regionMatches.length) return;
    const box=mk('div',{id:resultsId});
    regionMatches.slice(0,5).forEach(({name,tier,lat,lng})=>{
      const it=mk('div',{class:'sb-result-item'}); const tc=tier==='region'?'#6e1ac7':tier==='subregion'?'#785a37':'#388e9f';
      it.innerHTML=`<span class="sb-result-dot" style="background:${tc}"></span><span>${name}</span><span class="sb-result-cat">${tier}</span>`;
      it.addEventListener('click',()=>{map.flyTo([lat,lng],0,{animate:true,duration:0.8});removeResults();input.value=name;if(clearBtn)clearBtn.style.display='';if(onResultClick)onResultClick();});
      box.appendChild(it);
    });
    markerMatches.slice(0,10).forEach(({label,coords,category})=>{
      const it=mk('div',{class:'sb-result-item'});
      it.innerHTML=`<span class="sb-result-dot" style="background:${COLOURS[category]||'#ffa958'}"></span><span>${label}</span><span class="sb-result-cat">${category}</span>`;
      it.addEventListener('click',()=>{map.flyTo(coords,0,{animate:true,duration:0.8});removeResults();input.value=label;if(clearBtn)clearBtn.style.display='';if(onResultClick)onResultClick();});
      box.appendChild(it);
    });
    container.appendChild(box);
  }
  input.addEventListener('input',()=>{ const q=input.value.trim().toLowerCase(); if(clearBtn)clearBtn.style.display=q?'':'none'; doSearch(q); });
  input.addEventListener('keydown',e=>{ if(e.key==='Escape'){input.value='';if(clearBtn)clearBtn.style.display='none';clearSearch(layers,savedVis);searchActive=false;removeResults();} });
  if(clearBtn)clearBtn.addEventListener('click',()=>{ input.value='';clearBtn.style.display='none';clearSearch(layers,savedVis);searchActive=false;removeResults(); });
}

// ─── Counts, storage, clear ───────────────────────────────────────────────────
function updateCounts() {
  Object.keys(categoryRegistry).forEach(cat=>{
    const reg=categoryRegistry[cat], done=reg.markerIds.filter(id=>completedMarkers.has(id)).length;
    const el=document.querySelector(`.sb-cat-count[data-cat="${cat}"]`); if(!el) return;
    el.textContent=`${done}/${reg.total}`;
    el.style.color=done===reg.total&&reg.total>0?'#27ae60':done>0?'#e67e22':'#777';
    el.style.fontWeight=done>0?'bold':'normal';
  });
}
function updateLocalStorage() {
  const checked=[]; document.querySelectorAll('#sb-cat-list input[type="checkbox"]').forEach(cb=>{if(cb.checked)checked.push(cb.dataset.layer);});
  localStorage.setItem('checkedBoxes',JSON.stringify(checked));
}
function loadChecked(layers) {
  const saved=JSON.parse(localStorage.getItem('checkedBoxes'))||[];
  document.querySelectorAll('#sb-cat-list input[type="checkbox"]').forEach(inp=>{
    const n=inp.dataset.layer;
    if(saved.includes(n)){inp.checked=true;if(!hiddenGroups.has(n)&&layers[n])map.addLayer(layers[n]);}
    else{inp.checked=false;if(layers[n])map.removeLayer(layers[n]);}
  });
}
function clearSearch(layers, savedVis) {
  document.querySelectorAll('#sb-cat-list input[type="checkbox"]').forEach(cb=>{
    const n=cb.dataset.layer, was=savedVis[n]!==undefined?savedVis[n]:cb.checked;
    (was&&!hiddenGroups.has(n)&&layers[n])?map.addLayer(layers[n]):(layers[n]&&map.removeLayer(layers[n]));
  });
  allMarkers.forEach(({markerId,marker})=>{ const el=getMarkerEl(marker); if(!el) return; el.style.outline=''; el.style.display=''; el.style.opacity=''; applyCompletedStyle(marker,completedMarkers.has(markerId)); });
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function mk(tag,attrs={}){const e=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>k==='class'?(e.className=v):e.setAttribute(k,v));return e;}
function sep(attrs={}){const s=mk('span',attrs);s.classList.add('sb-sep');return s;}
function mkToolBtn(id,svg,tip){const b=mk('button',{id,class:'sb-tool-btn'});b.setAttribute('data-tip',tip);b.innerHTML=`${svg}<span class="sb-tool-label">${tip}</span>`;return b;}

// ─── Mobile route bottom bar ──────────────────────────────────────────────────
function showMobileRouteBar() {
  document.getElementById('mobile-route-bar')?.remove();
  // Hide sidebar
  const sb=document.getElementById('sidebar');
  const tog=document.getElementById('sb-toggle');
  if(sb&&tog){ const w=sb.classList.contains('compact')?52:290; sb.style.transform=`translateX(${w}px)`; tog.style.right='0'; tog.innerHTML='◀'; }

  const bar=mk('div',{id:'mobile-route-bar'});
  bar.style.cssText=`position:fixed;bottom:0;left:0;right:0;z-index:1200;display:flex;gap:0.5em;padding:0.75em 1em;background:linear-gradient(135deg,#785a37 50%,#8e6a41 50%);box-shadow:0 -3px 12px rgba(0,0,0,0.3);`;
  const label=mk('span'); label.style.cssText='color:white;font-size:0.82em;font-weight:700;flex:1;display:flex;align-items:center;'; label.textContent='Hold & drag to draw route';
  const finBtn=mk('button'); finBtn.style.cssText='padding:0.5em 1em;border-radius:6px;border:none;background:linear-gradient(135deg,#4c9da8 50%,#74babe 50%);color:white;font-weight:700;font-size:0.82em;cursor:pointer;';
  finBtn.textContent='✓ Finish';
  const canBtn=mk('button'); canBtn.style.cssText='padding:0.5em 0.8em;border-radius:6px;border:none;background:linear-gradient(135deg,#b0665d 50%,#ce715c 50%);color:white;font-weight:700;font-size:0.82em;cursor:pointer;';
  canBtn.textContent='✕ Cancel';
  finBtn.addEventListener('click',()=>{ finishRoute(); routeDrawing=false; hideMobileRouteBar(true); document.getElementById('sb-panel-custom')?.classList.add('active'); document.querySelector('[data-tab="custom"]')?.classList.add('active'); });
  canBtn.addEventListener('click',()=>{ routeDrawing=false; routePoints=[]; routeDrawActive=false; if(routePreviewLayer){map.removeLayer(routePreviewLayer);routePreviewLayer=null;} hideMobileRouteBar(true); });
  bar.appendChild(label); bar.appendChild(finBtn); bar.appendChild(canBtn);
  document.body.appendChild(bar);
  // Sync with sidebar finish/cancel buttons
  document.querySelector('#sb-panel-custom .cust-btn-route')?.dispatchEvent; // noop
}
function hideMobileRouteBar(reopenSidebar) {
  document.getElementById('mobile-route-bar')?.remove();
  if (reopenSidebar && isMobile()) {
    const sb=document.getElementById('sidebar');
    const tog=document.getElementById('sb-toggle');
    if(sb&&tog){ sb.style.transform=''; const w=sb.classList.contains('compact')?52:290; tog.style.right=w+'px'; tog.innerHTML='▶'; }
  }
}

loadData();
