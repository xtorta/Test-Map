// ─── Map ──────────────────────────────────────────────────────────────────────
const map = L.map('map', {
  crs: L.CRS.Simple, minZoom: -8, tap: true, tapTolerance: 15,
  zoomControl: !(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768),
});
const bounds = [[0,0],[5120,3584]];
const s1=0.89, s2=0.89, b1=-1595, b2=1724, coordToMapScalar=0.89;
L.imageOverlay('cropped.webp', bounds).addTo(map);
// fitBounds called after sidebar renders (see initMap)
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
  'Slimes':'#4cbb6a','Nepsids':'#3a9abf','Crabs':'#c0392b','Spirits':'#7f60c2',
  'Coyotes':'#c8853a','Skunks':'#8b5e3c','Kobolds':'#6a7a3a','Crimson':'#b03030',
  'Golems':'#888a7a','Sparkles':'#70c8d0','Bees':'#d4a017','Wolves':'#5a6a8a',
  'Boars':'#7a4a2a','Demons':'#8b1a1a','Sprouts':'#5a9a3a',
  'Copper':'#c67c3a','Tin':'#7a9bb5','Tungstene':'#9b7daa',
  'Madrigold':'#e8a030','Lavendula':'#9b59b6','Ancient Thyme':'#5d8a5e','Zealotus':'#c0392b',
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
  { key:'enemies',     title:'Enemies',           icon:'⚔️', cats:['Minibosses','Sparkling mobs'], hasMobSub:true },
];
const MOB_FACTIONS = {
  'Bees':     { icon:'./icons/mobs/bee.png' },
  'Boars':    { icon:'./icons/mobs/boar.png' },
  'Coyotes':  { icon:'./icons/mobs/coyote.png' },
  'Crabs':    { icon:'./icons/mobs/crab.png' },
  'Crimson':  { icon:'./icons/mobs/crimson.png' },
  'Demons':   { icon:'./icons/mobs/demon.png' },
  'Golems':   { icon:'./icons/mobs/golem.png' },
  'Sparkles': { icon:'./icons/mobs/sparkle.png' },
  'Kobolds':  { icon:'./icons/mobs/kobold.png' },
  'Nepsids':  { icon:'./icons/mobs/nepsid.png' },
  'Skunks':   { icon:'./icons/mobs/skunk.png' },
  'Slimes':   { icon:'./icons/mobs/slime.png' },
  'Spirits':  { icon:'./icons/mobs/spirits.png' },
  'Sprouts':  { icon:'./icons/mobs/sprout.png' },
  'Wolves':   { icon:'./icons/mobs/wolf.png' },
};
const ORE_SUBS   = {
  'Copper':    { labels:['Copper Ore Large','Copper Ore Small'], icon:'./icons/gatherables/copper.png?v=3' },
  'Tin':       { labels:['Tin Ore Large','Tin Ore Small'],       icon:'./icons/gatherables/tin.png?v=3' },
  'Tungstene': { labels:['Tungstene'],                           icon:'./icons/gatherables/tungstene.png?v=3' },
};
const PLANT_SUBS = {
  'Madrigold':    { labels:['Madrigold Large','Madrigold Small'],          icon:'./icons/gatherables/madrigold.png?v=3' },
  'Lavendula':    { labels:['Lavendula Large','Lavendula Small','R 2Plant 2 Small','R 2Plant 3 Small','R 2Plant Rare Large','R 2Plant Rare Small'], icon:'./icons/gatherables/lavendula.png?v=3' },
  'Ancient Thyme':{ labels:['Ancient Thyme Large','Ancient Thyme Small'],  icon:'./icons/gatherables/ancientthyme.png?v=3' },
  'Zealotus':     { labels:['Zealotus','Zealotus Large','Zealotus Small'], icon:'./icons/gatherables/zealous.png?v=3' },
};
const MOB_UNIT_FACTION = {
  // Bees
  'Z1_Bee_Patrol_World':'Bees','Z1_Bee_Tree':'Bees','Z2_Bee_Nescent':'Bees',
  'Z2_Bee_Nescent_3':'Bees','Z2_Bee_Patrol_World_Elite':'Bees',
  // Crimson
  'Crimson_Z1W_Sword_2':'Crimson','Dog_Z1W_Crimson':'Crimson',
  'Z1_Crimson_Patrol_Stronghold_World':'Crimson','Z1_Crimson_Patrol_Stronghold_World_1':'Crimson',
  'Z1_Crimson_Patrol_Stronghold_World_2':'Crimson','Z1_Crimson_Patrol_Stronghold_World_Unique':'Crimson',
  'Z2_Crimson_Patrol_World':'Crimson','Z2_Crimson_Patrol_World_2':'Crimson',
  'Z2_Crimson_Patrol_World_3':'Crimson','Z2_Crimson_Patrol_World_4':'Crimson',
  'Z2_Crimson_Patrol_World_6':'Crimson','Z2_Crimson_Peasant_Nescent':'Crimson',
  'TODO_Z2W_Peasant':'Crimson',
  // Golems
  'Golem_Z2W_Wind2':'Golems','Z2_Golem_Eksod_Exterior':'Golems','Z2_Golem_Eksod_Interior':'Golems',
  'Z2_Golem_Krisomal_Exterior':'Golems','Z2_Golem_Krisomal_Interior':'Golems',
  // Sparkles (golem-family, distinct icon)
  'Elemental_Z1W_Earth':'Sparkles',
  'Elemental_Z1W_Earth_2':'Sparkles',
  'Elemental_Z1W_Underwater':'Sparkles',   // Naya Sparkle — was wrongly Spirits
  'Elemental_Z2W_Underwater_U':'Sparkles', // Aquamarine Sparkle
  // Spirits (non-sparkle elementals + herald)
  'Elemental_Z2W':'Spirits','Elemental_Z2W_2':'Spirits',
  'Elemental_Z2W_Underwater_2':'Spirits','TODO_Z1W_HeraldSpirit':'Spirits',
  // Kobolds
  'Z1_Kobold_Mines_2':'Kobolds','Z1_Kobold_Patrol_Unique':'Kobolds',
  'Z2_Kobold_Eksod':'Kobolds','Z2_Kobold_Eksod_Ogre':'Kobolds',
  // Nepsids
  'Z2_Manfish_Krisomal':'Nepsids',
  // Sprouts
  'Z2_Plant_Azuram_NoRice':'Sprouts','Z2_Plant_Nescent_NoRice':'Sprouts',
  // Wolves (true wolves)
  'Z1_Forest':'Wolves',
  // Coyotes (wild zone patrols — coyote icon)
  'Z1_Start_Patrol_World':'Coyotes','Z2_Wild_Azuram':'Coyotes','Z2_Wild_Nescent':'Coyotes',
  // Critters (miscategorised as Mobs in data)
  'Z1_World_Critters_Lizard':'__Critters__',
  'Z1_World_Critters_Squirel':'__Critters__',
  'Z1_World_Critters_Frog':'__Critters__',
  'Z1_World_Critters_Ladybugs':'__Critters__',
  'Z1_World_Critters_StinkBug':'__Critters__',
  'Z1_World_Critters_Tortorock':'__Critters__',
  'Z1_World_Critters_Sheep':'__Critters__',
  // Dummy — skip
  'Dummy':'__skip__',
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
  trash:   `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><polyline points="1,3 13,3"/><path d="M4 3V2h6v1"/><rect x="3" y="4" width="8" height="9" rx="1"/></svg>`,
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
function makeRegionIcon(name, tier, interactive) {
  const cursor = interactive ? 'cursor:pointer;' : 'pointer-events:none;';
  const base = getLabelCSS(tier, map.getZoom()).replace('pointer-events:none;','').replace('cursor:default;','');
  return L.divIcon({
    html: `<div style="${base}${cursor}">${name}</div>`,
    className: '', iconAnchor:[0,0], iconSize:null
  });
}
function isRegionVisible(tier) { return tier==='region'?showRegions:tier==='subregion'?showSubregions:showZones; }
function isZoomVisible(tier) {
  const z = map.getZoom();
  if (tier === 'zone')      return z >= 0;    // zones only at zoom 0+
  if (tier === 'subregion') return z >= -2;   // subregions at medium zoom
  return true;                                 // regions always
}
function refreshRegionVisibility() {
  regionLabels.forEach(({marker,tier}) => {
    if (isRegionVisible(tier) && isZoomVisible(tier)) {
      if (!regionLayer.hasLayer(marker)) marker.addTo(regionLayer);
    } else {
      regionLayer.removeLayer(marker);
    }
  });
}
map.on('zoomend', () => {
  // First update visibility (adds/removes markers)
  refreshRegionVisibility();
  // Then refresh icons for everything currently visible
  regionLabels.forEach(({marker,name,tier}) => {
    if (regionLayer.hasLayer(marker)) {
      const interactive = (tier === 'region' || tier === 'subregion' || tier === 'zone');
      marker.setIcon(makeRegionIcon(name, tier, interactive));
    }
  });
});
async function loadRegions() {
  try {
    const r = await fetch('regions.json'); if (!r.ok) return;
    const data = await r.json();

    // Group zones by their nearest region for bounding box calculation
    const regionEntries = data.filter(d => d.tier === 'region');
    const zoneEntries   = data.filter(d => d.tier === 'zone');

    // Assign each zone to nearest region
    function nearestRegion(lat, lng) {
      let best = null, bestDist = Infinity;
      regionEntries.forEach(re => {
        const d = Math.hypot(re.lat - lat, re.lng - lng);
        if (d < bestDist) { bestDist = d; best = re.name; }
      });
      return best;
    }
    const regionZones = {}; // regionName → [{lat,lng}]
    zoneEntries.forEach(z => {
      const rn = nearestRegion(z.lat, z.lng);
      if (rn) { if (!regionZones[rn]) regionZones[rn] = []; regionZones[rn].push(z); }
    });

    data.forEach(({name,tier,lat,lng}) => {
      const interactive = (tier === 'region' || tier === 'subregion' || tier === 'zone');
      const icon = makeRegionIcon(name, tier, interactive);
      const m = L.marker([lat,lng], {
        icon,
        interactive,
        keyboard: false,
        zIndexOffset: tier==='region'?1000:tier==='subregion'?700:500
      });

      if (interactive) {
        m.on('click', () => {
          if (tier === 'region') {
            // Fit bounding box of all its zones
            const zones = regionZones[name] || [];
            if (zones.length > 1) {
              const lats = [lat, ...zones.map(z=>z.lat)];
              const lngs = [lng, ...zones.map(z=>z.lng)];
              const pad  = 80;
              map.flyToBounds([[Math.min(...lats)-pad, Math.min(...lngs)-pad],[Math.max(...lats)+pad, Math.max(...lngs)+pad]], {animate:true, duration:0.8, padding:[40,40]});
            } else {
              map.flyTo([lat, lng], -2, {animate:true, duration:0.8});
            }
          } else if (tier === 'subregion') {
            map.flyTo([lat, lng], -1, {animate:true, duration:0.6});
          } else {
            map.flyTo([lat, lng], 0, {animate:true, duration:0.5});
          }
        });
        m.getElement && m.on('add', () => {
          const el = m.getElement();
          if (el) el.style.cursor = 'pointer';
        });
      }

      regionLabels.push({name,tier,lat,lng,marker:m});
      if (isRegionVisible(tier) && isZoomVisible(tier)) m.addTo(regionLayer);
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
let globalRouteOpacity = parseFloat(localStorage.getItem('routeOpacity')||'0.88');

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
  localStorage.setItem('customRoutes',  JSON.stringify(customRoutes.map(({points,colour,note,opacity})=>({points,colour,note:note||'',opacity:opacity??0.88}))));
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
    const sb = document.getElementById('sidebar');
    if (sb && !sb.style.transform) {
      sb.style.transform = `translateX(${sb.offsetWidth||310}px)`;
      let done = false;
      setTimeout(() => map.once('popupclose', () => { if(!done){done=true; sb.style.transform='';} }), 150);
    }
  }
  marker.openPopup();
}
// Hide sidebar on mobile for all popups (game markers, routes)
map.on('popupopen', () => {
  if (!isMobile()) return;
  const sb = document.getElementById('sidebar');
  if (!sb || sb.style.transform) return;
  sb.style.transform = `translateX(${sb.offsetWidth||310}px)`;
  map.once('popupclose', () => { sb.style.transform = ''; });
});
function renderRoutes() {
  custRouteLayer.clearLayers();
  if (!routesVisible) { window._routeRenderHook?.(); return; }
  customRoutes.forEach((route, ri) => {
    if (route.points.length < 2) return;
    const raw = route.points.map(p=>[p[0],p[1]]);
    const smooth = raw;
    const colour = route.colour||'#e74c3c';
    const opacity = (route.hidden ? 0 : globalRouteOpacity);
    if (route.hidden) return; // skip hidden routes
    const line = L.polyline(smooth, { color:colour, weight:3.5, opacity:opacity, smoothFactor:1 });
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
    const smooth = routePoints;
    routePreviewLayer = L.polyline(smooth, {color:selectedCustColour, weight:3, dashArray:'5 4', opacity:0.8, smoothFactor:1}).addTo(map);
  }
}
function finishRoute() {
  const sub = subsample(routePoints, 30);
  if (sub.length >= 2) { customRoutes.push({points:sub, colour:selectedCustColour, note:''}); saveCustom(); renderRoutes(); }
  routePoints = []; routeDrawActive = false;
  if (routePreviewLayer) { map.removeLayer(routePreviewLayer); routePreviewLayer=null; }
}

// ─── Permalink: read URL hash on load ────────────────────────────────────────
(function readPermalink() {
  // Priority 1: URL hash (shared link)
  const hash = window.location.hash.replace('#','');
  const m = hash.match(/^@(-?\d+\.?\d*),(-?\d+\.?\d*),([-\d.]+)$/);
  if (m) {
    map.setView([parseFloat(m[1]), parseFloat(m[2])], parseFloat(m[3]));
    window._permalinkApplied = true;
    return;
  }
  // Priority 2: last saved position in localStorage
  try {
    const saved = localStorage.getItem('mapLastPos');
    if (saved) {
      const {lat,lng,zoom} = JSON.parse(saved);
      map.setView([lat,lng], zoom);
      window._permalinkApplied = true; // skip fitBounds
    }
  } catch(e) {}
})();

// Save position continuously
map.on('moveend', () => {
  const c = map.getCenter(), z = map.getZoom();
  localStorage.setItem('mapLastPos', JSON.stringify({lat:+c.lat.toFixed(2),lng:+c.lng.toFixed(2),zoom:+z.toFixed(2)}));
});

function copyPermalink() {
  const c = map.getCenter();
  const z = map.getZoom();
  const hash = `#@${c.lat.toFixed(1)},${c.lng.toFixed(1)},${z.toFixed(1)}`;
  const url  = window.location.origin + window.location.pathname + hash;
  window.history.replaceState(null, '', hash);
  navigator.clipboard?.writeText(url).then(() => {
    showToast('📋 Link copied!');
  }).catch(() => {
    prompt('Copy this link:', url);
  });
}
function showToast(msg) {
  let t = document.getElementById('map-toast');
  if (!t) { t = document.createElement('div'); t.id='map-toast'; t.style.cssText='position:fixed;bottom:5em;left:50%;transform:translateX(-50%);background:rgba(30,20,10,0.88);color:white;padding:0.5em 1.2em;border-radius:20px;font-size:0.88em;font-weight:700;z-index:2000;pointer-events:none;transition:opacity 0.4s;'; document.body.appendChild(t); }
  t.textContent = msg; t.style.opacity='1';
  clearTimeout(t._to);
  t._to = setTimeout(() => t.style.opacity='0', 2000);
}
// ─── Dungeon label fixes & wiki links ────────────────────────────────────────
const DUNGEON_NAME_FIX = {
  'Honeyzabethâ€™s Hivetrunk': "Honeyzabeth's Hivetrunk",
  'Honeyzabeth\u2019s Hivetrunk': "Honeyzabeth's Hivetrunk",
};
const DUNGEON_WIKI = {
  'Lost City of Mayda':       { w:'Lost_City_of_Mayda',       a:'Lost_City_of_Mayda_(walkthrough)' },
  'Mine Estrone':             { w:'Mine_Estrone',             a:'Mine_Estrone_(walkthrough)' },
  "Crabgantua's Gorge":       { w:"Crabgantua's_Gorge",       a:"Crabgantua's_Gorge_(walkthrough)" },
  "Ratsar's Lair":            { w:"Ratsar's_Lair",            a:"Ratsar's_Lair_(walkthrough)" },
  'Trunk of the Hivetree':    { w:'Trunk_of_the_Hivetree',    a:'Trunk_of_the_Hivetree' },
  "Lady Bee's Palace":        { w:"Lady_Bee's_Palace",        a:"Lady_Bee's_Palace_(walkthrough)" },
  "Ruins of Gorgon's Hollow": { w:"Ruins_of_Gorgon's_Hollow", a:"Ruins_of_Gorgon's_Hollow" },
  'Abyss of New Atlaan':      { w:'Abyss_of_New_Atlaan',      a:'Abyss_of_New_Atlaan' },
  "Honeyzabeth's Hivetrunk":  { w:"Honeyzabeth's_Hivetrunk",  a:"Honeyzabeth's_Hivetrunk" },
  'Cheese Station':           { w:'Cheese_Station',           a:'Cheese_Station' },
  'Crimson Barracks':         { w:'Crimson_Barracks',         a:'Crimson_Barracks' },
  "Chakram's Chapel":         { w:"Chakram's_Chapel",         a:"Chakram's_Chapel" },
};
const WIKI_LOOT_PAGE = 'https://farever.wiki/Dungeons_loots:_Armors_%26_Weapons';
function getDungeonLabel(rawLabel, coords) {
  if (DUNGEON_NAME_FIX[rawLabel]) return DUNGEON_NAME_FIX[rawLabel];
  if (rawLabel === 'Dungeon entrance') {
    const [lat, lng] = coords;
    if (lat > 1400 && lat < 1600 && lng > 2400 && lng < 2750) return "Ruins of Gorgon's Hollow";  // lat~1495, lng~2587
    if (lat < 800  && lng > 2900)                              return 'Abyss of New Atlaan';        // lat~670,  lng~3050
    if (lat < 500  && lng > 1400 && lng < 1900)               return 'Lost City of Mayda';         // lat~386,  lng~1627
    if (lat > 1800 && lng > 3400)                              return "Honeyzabeth's Hivetrunk";    // lat~1907, lng~3582
    if (lat > 1100 && lat < 1350 && lng < 900)                return 'Trunk of the Hivetree';      // lat~1269, lng~749
    if (lat > 1350 && lat < 1500 && lng < 900)                return "Lady Bee's Palace";          // lat~1412, lng~755
  }
  return rawLabel;
}
function dungeonWikiLink(label) {
  const entry = DUNGEON_WIKI[label]; if (!entry) return '';
  const weaponUrl = WIKI_LOOT_PAGE + '#Weapons';
  const armorUrl  = WIKI_LOOT_PAGE + '#' + entry.a;
  const base = 'display:flex;align-items:center;justify-content:center;gap:0.4em;padding:0.5em 1em;border-radius:5px;text-decoration:none;font-size:1.05em;font-weight:700;color:white;letter-spacing:0.02em;';
  const wStyle = base + 'background:linear-gradient(135deg,#b0665d 50%,#ce715c 50%);';
  const aStyle = base + 'background:linear-gradient(135deg,#6e1ac7 50%,#8a35e0 50%);';
  return '<div style="display:flex;flex-direction:column;gap:0.4em;margin-top:0.65em;">'
    + '<a href="' + weaponUrl + '" target="_blank" rel="noopener" style="' + wStyle + '">&#9876;&#xFE0F; Weapon Loot</a>'
    + '<a href="' + armorUrl  + '" target="_blank" rel="noopener" style="' + aStyle + '">&#128737;&#xFE0F; Armor Loot</a>'
    + '</div>';
}


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
  // Pre-build registry for non-gatherable, non-faction categories only
  const gatherableLabels = new Set();
  ['Ores','Plants'].forEach(mc => {
    Object.values(GATHERABLE_SUBS[mc]).forEach(({labels}) => labels.forEach(l => gatherableLabels.add(l.toLowerCase())));
  });
  data.forEach((item,idx)=>{
    const cat=item.categories?.[0]||'Misc';
    if (gatherableLabels.has(item.label.toLowerCase())) return;
    if (cat === 'Mobs') {
      const uf = item.unitFaction && MOB_FACTIONS[item.unitFaction] ? item.unitFaction : MOB_UNIT_FACTION[item.unit||''];
      if (uf === '__skip__') return; // Dummy items
      if (uf === '__Critters__') { // count toward Critters
        if(!categoryRegistry['Critters']) categoryRegistry['Critters']={total:0,markerIds:[],markers:[]};
        categoryRegistry['Critters'].total++; categoryRegistry['Critters'].markerIds.push(getMarkerId(item,idx)); return;
      }
      if (uf) return; // counted via faction pre-count below
    }
    if(!categoryRegistry[cat]) categoryRegistry[cat]={total:0,markerIds:[],markers:[]};
    categoryRegistry[cat].total++;
    categoryRegistry[cat].markerIds.push(getMarkerId(item,idx));
  });

  // Build subtype icon + layer lookup: label → {iconUrl, subKey, layerKey}
  const subTypeMap = {};
  ['Ores','Plants'].forEach(mainCat => {
    const subs = GATHERABLE_SUBS[mainCat];
    Object.entries(subs).forEach(([subKey,{labels,icon}]) => {
      const layerKey = subKey;
      if (!layers[layerKey]) layers[layerKey] = L.layerGroup();
      if (!categoryRegistry[layerKey]) categoryRegistry[layerKey] = {total:0, markerIds:[], markers:[], mainCat};
      labels.forEach(lbl => { subTypeMap[lbl.toLowerCase()] = {iconUrl:icon, subKey, layerKey, mainCat}; });
    });
  });

  // Build mob faction layers
  Object.entries(MOB_FACTIONS).forEach(([faction, {icon}]) => {
    if (!layers[faction]) layers[faction] = L.layerGroup();
    if (!categoryRegistry[faction]) categoryRegistry[faction] = {total:0, markerIds:[], markers:[], mainCat:'Mobs'};
  });
  // Pre-count faction mobs
  data.forEach((item,idx)=>{
    const cat=item.categories?.[0]||'Misc';
    if (cat !== 'Mobs') return;
    const faction = /\bsparkle\b/i.test(item.label||'') && !/\bsparkling\b/i.test(item.label||'') ? 'Sparkles'
      : /\bslime\b/i.test(item.label||'') ? 'Slimes'
      : item.unitFaction && MOB_FACTIONS[item.unitFaction] ? item.unitFaction
      : (MOB_UNIT_FACTION[item.unit||''] || null);
    if (!faction || faction === '__skip__' || faction === '__Critters__') return;
    categoryRegistry[faction].total++;
    categoryRegistry[faction].markerIds.push(getMarkerId(item,idx));
    // Also count in extra factions detected from label
    const lbl = item.label || '';
    const extras = [];
    if (/\bboar/i.test(lbl)    && faction !== 'Boars')   extras.push('Boars');
    if (/\bcoyote/i.test(lbl)  && faction !== 'Coyotes') extras.push('Coyotes');
    if (/\bwolf\b|\bwolves\b/i.test(lbl) && faction !== 'Wolves') extras.push('Wolves');
    if (/\bsparkle\b/i.test(lbl) && !/\bsparkling\b/i.test(lbl) && faction !== 'Sparkles') extras.push('Sparkles');
    if (/\bgolem/i.test(lbl)   && faction !== 'Golems')  extras.push('Golems');
    extras.forEach(f => {
      if (categoryRegistry[f]) { categoryRegistry[f].total++; categoryRegistry[f].markerIds.push(getMarkerId(item,idx)); }
    });
  });

  data.forEach((item,idx)=>{
    const coords=[(s1*(4096-item.y)+b1),s2*(item.x+b2)];
    const cat=item.categories?.[0]||'Misc';
    const subInfo = subTypeMap[item.label.toLowerCase()];
    // Mob faction routing
    const mobFaction = (cat==='Mobs')
      ? (/\bsparkle\b/i.test(item.label||'') && !/\bsparkling\b/i.test(item.label||'') ? 'Sparkles'
         : /\bslime\b/i.test(item.label||'') ? 'Slimes'
         : item.unitFaction && MOB_FACTIONS[item.unitFaction] ? item.unitFaction
         : MOB_UNIT_FACTION[item.unit||''] || null)
      : null;
    // Skip dummy/test markers
    if (mobFaction === '__skip__') return;
    // Critters miscategorised as Mobs
    const effectiveCat = subInfo ? subInfo.layerKey
      : mobFaction === '__Critters__' ? 'Critters'
      : mobFaction ? mobFaction
      : cat;
    if (!layers[effectiveCat]) layers[effectiveCat]=L.layerGroup();
    let m;
    if (subInfo && subInfo.iconUrl) {
      const sz=28;
      const icon = L.icon({iconUrl:subInfo.iconUrl, iconSize:[sz,sz], iconAnchor:[sz/2,sz/2], popupAnchor:[0,-sz/2]});
      m = L.marker(coords, {icon});
    } else if (mobFaction && MOB_FACTIONS[mobFaction]) {
      const sz=32;
      const icon = L.icon({iconUrl:MOB_FACTIONS[mobFaction].icon, iconSize:[sz,sz], iconAnchor:[sz/2,sz/2], popupAnchor:[0,-sz/2]});
      m = L.marker(coords, {icon});
    } else if (effectiveCat in iconDict) {
      m = L.marker(coords,{icon:L.icon(iconDict[effectiveCat])});
    } else if (effectiveCat in circleDict) {
      m = L.circle(coords,circleDict[effectiveCat]);
    } else if (effectiveCat in stylingDict) {
      m = L.circleMarker(coords,stylingDict[effectiveCat]);
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
    // Track counts for subtype layers (gatherables, mob factions)
    if (subInfo && categoryRegistry[effectiveCat]) {
      categoryRegistry[effectiveCat].total++;
      categoryRegistry[effectiveCat].markerIds.push(mid);
    }
    // Fix dungeon display names and add wiki link
    const displayLabel = cat==='Dungeons' ? getDungeonLabel(item.label, coords) : item.label;
    const wikiLink = cat==='Dungeons' ? dungeonWikiLink(displayLabel) : '';
    allMarkers.push({markerId:mid,marker:m,category:effectiveCat,label:displayLabel,coords,subKey:subInfo?.subKey,mainCat:subInfo?.mainCat||mobFaction?'Mobs':null});
    m.bindPopup(`<div style="text-align:center;font-family:Noto,sans-serif;">${displayLabel}${wikiLink}</div>`);
    m.on('contextmenu',e=>{ L.DomEvent.preventDefault(e); L.DomEvent.stopPropagation(e); m.closePopup(); toggleComplete(mid,m,cat); });
    m.on('click',e=>{ if (!isMobile()||routeDrawing) return; toggleComplete(mid,m,cat); });
    m.on('add',()=>setTimeout(()=>applyCompletedStyle(m,completedMarkers.has(mid)),0));
    // Detect additional factions from label (multi-species spawn points)
    const extraFactions = [];
    if (cat === 'Mobs' && mobFaction) {
      const lbl = item.label || '';
      if (/\bboar/i.test(lbl)    && mobFaction !== 'Boars')   extraFactions.push('Boars');
      if (/\bcoyote/i.test(lbl)  && mobFaction !== 'Coyotes') extraFactions.push('Coyotes');
      if (/\bwolf\b|\bwolves\b/i.test(lbl) && mobFaction !== 'Wolves') extraFactions.push('Wolves');
      if (/\bsparkle\b/i.test(lbl) && !/\bsparkling\b/i.test(lbl) && mobFaction !== 'Sparkles') extraFactions.push('Sparkles');
      if (/\bgolem/i.test(lbl)   && mobFaction !== 'Golems')  extraFactions.push('Golems');
    }
    const allFactions = mobFaction && MOB_FACTIONS[mobFaction] ? [mobFaction, ...extraFactions] : null;

    // For multi-faction markers: add to map directly, control visibility via updateMultiFactionIcons
    if (allFactions && allFactions.length > 1) {
      const sz = 32;
      const overlap = 14;
      function makeMultiIcon(show) {
        if (show.length === 1) {
          return L.icon({iconUrl:MOB_FACTIONS[show[0]].icon, iconSize:[sz,sz], iconAnchor:[sz/2,sz/2], popupAnchor:[0,-sz/2]});
        }
        const totalW = sz + (show.length - 1) * (sz - overlap);
        const imgs = show.map((f,i) =>
          `<img src="${MOB_FACTIONS[f].icon}" width="${sz}" height="${sz}" style="position:absolute;left:${i*(sz-overlap)}px;top:0;">`
        ).join('');
        return L.divIcon({
          html:`<div style="position:relative;width:${totalW}px;height:${sz}px;">${imgs}</div>`,
          className:'', iconSize:[totalW,sz], iconAnchor:[totalW/2,sz/2], popupAnchor:[0,-sz/2]
        });
      }
      m.setIcon(makeMultiIcon(allFactions));
      m._allFactions = allFactions;
      m._makeMultiIcon = makeMultiIcon;
      // Add directly to map — visibility controlled by updateMultiFactionIcons
      m.addTo(map);
    } else {
      m.addTo(layers[effectiveCat]);
      extraFactions.forEach(f => { if (layers[f]) m.addTo(layers[f]); });
    }
  });

  // Map mouse/touch events for route drawing and marker placement
  const mapEl = map.getContainer();

  // Desktop: mousedown starts drawing, mousemove adds points, mouseup PAUSES (shows Finish/Cancel)
  mapEl.addEventListener('mousedown', e => {
    if (!routeDrawing || e.button !== 0) return;
    map.dragging.disable();
    routeDrawActive = true;
    if (!routePoints.length) routePoints = [];
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
    routeDrawActive = false;
    // Don't auto-save — show Finish/Cancel so user confirms
    window._showDesktopRouteControls?.();
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
  updateMultiFactionIcons();
  loadRegions().then(() => refreshRegionVisibility());
  renderCustomMarkers();
  renderRoutes();
  // Fit full map now that sidebar is rendered, unless a permalink set the view
  if (!window._permalinkApplied) {
    setTimeout(() => { map.invalidateSize(); map.fitBounds(bounds, {animate:false}); refreshRegionVisibility(); }, 150);
  } else {
    setTimeout(() => refreshRegionVisibility(), 150);
  }
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

  // ── About ─────────────────────────────── moved inside filter panel ──
  // ── Search ────────────────────────────── moved inside filter panel ──

  // ── Tabs: Filter / Custom / Routes ──────────────────────────────────
  const tabBar=mk('div',{id:'sb-tabs'});
  [{key:'filter',label:'Filter'},{key:'custom',label:'Add Icons'},{key:'routes',label:'Routes'}].forEach((t,i)=>{
    const btn=mk('button',{class:'sb-tab'+(i===0?' active':'')}); btn.dataset.tab=t.key; btn.textContent=t.label;
    btn.addEventListener('click',()=>{
      tabBar.querySelectorAll('.sb-tab').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
      sidebar.querySelectorAll('.sb-panel').forEach(p=>p.classList.remove('active'));
      document.getElementById(`sb-panel-${t.key}`)?.classList.add('active');
    });
    tabBar.appendChild(btn);
  });
  sidebar.appendChild(tabBar);

  // ── Panel: Filter (tools + zones + filters all inside) ───────────
  const filterPanel=mk('div',{id:'sb-panel-filter',class:'sb-panel active'});

  // Tool row inside filter panel
  const iconTools=mk('div',{id:'sb-icon-tools'});
  const searchToolBtn=mkToolBtn('sb-search-tool',SVG.search,'Search'); searchToolBtn.classList.add('compact-only');
  const completedRow=mk('div',{style:'display:flex;border-bottom:1px solid rgba(0,0,0,0.07);flex-shrink:0;'});
  const hideBtn=mk('button',{id:'sb-hide-btn',class:'sb-tool-btn',style:'border-bottom:none;border-right:1px solid rgba(0,0,0,0.07);flex:1;'}); hideBtn.setAttribute('data-tip','Hide Completed'); hideBtn.innerHTML=`${SVG.eye}<span class="sb-tool-label">Hide Completed</span>`;
  const resetBtn=mk('button',{id:'sb-reset-btn',class:'sb-tool-btn',style:'border-bottom:none;flex:1;color:#c0392b;'}); resetBtn.setAttribute('data-tip','Reset Completed'); resetBtn.innerHTML=`${SVG.reset}<span class="sb-tool-label">Reset Completed</span>`;
  completedRow.appendChild(hideBtn); completedRow.appendChild(resetBtn);
  const shareBtn=mkToolBtn('sb-share-btn',`<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="3" r="2"/><circle cx="4" cy="8" r="2"/><circle cx="12" cy="13" r="2"/><line x1="6" y1="9" x2="10" y2="12"/><line x1="10" y1="4" x2="6" y2="7"/></svg>`,'Share Location');
  shareBtn.addEventListener('click', copyPermalink);
  iconTools.appendChild(searchToolBtn); iconTools.appendChild(completedRow); iconTools.appendChild(shareBtn);
  filterPanel.appendChild(iconTools);
  filterPanel.appendChild(sep());

  // Zone toggles inside filter panel
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
  filterPanel.appendChild(zoneTogs);
  filterPanel.appendChild(sep());

  const catList=mk('div',{id:'sb-cat-list'});

  // ── Search (scrolls with filter content) ──────────────────────────
  const searchRow=mk('div',{id:'sb-search-row',style:'flex-shrink:0;'});
  searchRow.innerHTML=`<input id="sb-search" type="text" placeholder="🔍 Search markers & regions…" autocomplete="off"><button id="sb-search-clear" style="display:none">✕</button>`;
  catList.appendChild(searchRow);
  catList.appendChild(sep());

  // ── About (scrolls with filter content) ───────────────────────────
  const aboutRow=mk('div',{id:'sb-about-row',style:'flex-shrink:0;'});
  aboutRow.innerHTML=`<span>ℹ️ About</span><span id="sb-about-chevron">${aboutOpen?'▲':'▼'}</span>`;
  const aboutPanel=mk('div',{id:'sb-about-panel'});
  aboutPanel.style.display=aboutOpen?'block':'none';
  aboutPanel.innerHTML=`Welcome to the Farever interactive map, built by the <a href="https://farever.wiki" target="_blank">Farever Wiki</a> team.<br><br>This map pulls data directly from the game. You can use the buttons to filter what is displayed. Note that some items have had their locations slightly obscured to avoid spoiling the fun of exploration! You will find them within the indicated area.<br><br>Please send any feedback about this map or the wiki to <strong>@IceCaveBear</strong> on Discord.`;
  aboutRow.addEventListener('click',()=>{ const o=aboutPanel.style.display==='block'; aboutPanel.style.display=o?'none':'block'; document.getElementById('sb-about-chevron').textContent=o?'▼':'▲'; localStorage.setItem('sbAboutOpen',o?'0':'1'); });
  catList.appendChild(aboutRow);
  catList.appendChild(aboutPanel);
  catList.appendChild(sep({id:'sb-sep-about'}));
  FILTER_GROUPS.forEach(group => {
    const groupDiv=mk('div',{class:'filter-group'});
    const groupCollapsed=localStorage.getItem(`fg_${group.key}`)==='1';
    if(groupCollapsed) groupDiv.classList.add('collapsed');

    // Group header
    const ghdr=mk('div',{class:'filter-group-header'});
    ghdr.setAttribute('data-group', group.key);
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
        const subs = mainCat==='Plants' ? PLANT_SUBS : ORE_SUBS;
        const colour = COLOURS[mainCat]||'#ffa958';
        const subDiv = mk('div',{class:'filter-subgroup'});
        if(localStorage.getItem(`fsg_${mainCat}`)==='1') subDiv.classList.add('collapsed');
        const shdr = mk('div',{class:'filter-subgroup-header'});
        shdr.setAttribute('data-sub', mainCat);
        const shdrTitle = mk('span',{class:'fsh-title',style:'flex:1;'}); shdrTitle.textContent = mainCat;
        const shdrChev = mk('span',{class:'fsh-chevron'}); shdrChev.textContent='▼';
        shdr.appendChild(shdrTitle); shdr.appendChild(shdrChev);
        shdr.addEventListener('click', () => { subDiv.classList.toggle('collapsed'); localStorage.setItem(`fsg_${mainCat}`, subDiv.classList.contains('collapsed')?'1':'0'); });
        subDiv.appendChild(shdr);
        const subRows = mk('div',{class:'filter-subgroup-rows'});
        Object.entries(subs).forEach(([subName,{icon}]) => { subRows.appendChild(buildCatRow(subName, layers, icon)); });
        subDiv.appendChild(subRows);
        groupRows.appendChild(subDiv);
      });
    } else if (group.hasMobSub) {
      // Enemies: Minibosses + Sparkling mobs first, then Mobs subgroup with factions
      group.cats.forEach(cat => { if (layers[cat]||categoryRegistry[cat]) groupRows.appendChild(buildCatRow(cat, layers)); });
      // Mobs subgroup
      const mobDiv = mk('div',{class:'filter-subgroup'});
      if(localStorage.getItem('fsg_Mobs')==='1') mobDiv.classList.add('collapsed');
      const mobHdr = mk('div',{class:'filter-subgroup-header'});
      mobHdr.setAttribute('data-sub','Mobs');
      const mobTitle = mk('span',{class:'fsh-title',style:'flex:1;'}); mobTitle.textContent='Mobs';
      const mobChev = mk('span',{class:'fsh-chevron'}); mobChev.textContent='▼';
      mobHdr.appendChild(mobTitle); mobHdr.appendChild(mobChev);
      mobHdr.addEventListener('click',()=>{ mobDiv.classList.toggle('collapsed'); localStorage.setItem('fsg_Mobs',mobDiv.classList.contains('collapsed')?'1':'0'); });
      mobDiv.appendChild(mobHdr);
      const mobRows = mk('div',{style:'display:grid;grid-template-columns:1fr 1fr;gap:0;'});
      Object.entries(MOB_FACTIONS).forEach(([faction,{icon}]) => {
        mobRows.appendChild(buildCatRow(faction, layers, icon));
      });
      if (categoryRegistry['Mobs']) mobRows.appendChild(buildCatRow('Mobs', layers));
      mobDiv.appendChild(mobRows);
      groupRows.appendChild(mobDiv);
    } else {
      group.cats.forEach(cat => { if (layers[cat]) groupRows.appendChild(buildCatRow(cat, layers)); });
    }
    groupDiv.appendChild(ghdr); groupDiv.appendChild(groupRows);
    catList.appendChild(groupDiv);
  });

  // Scroll indicators
  // Scroll indicators removed - they caused layout recalculation on every scroll event

  filterPanel.appendChild(catList);
  sidebar.appendChild(filterPanel);

  // ── Compact list (icon-only, all cats) ───────────────────────────
  const compactList=mk('div',{id:'sb-compact-list'});
  let prevGroup='';
  FILTER_GROUPS.forEach(group=>{
    if (group.key==='zones') return;
    if (prevGroup && prevGroup!==group.key) { compactList.appendChild(mk('span',{class:'compact-cat-sep'})); }
    const cats = group.hasSub
      ? [...Object.keys(PLANT_SUBS), ...Object.keys(ORE_SUBS)]
      : group.hasMobSub
      ? [...group.cats, ...Object.keys(MOB_FACTIONS)]
      : group.cats;
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

  // ── Panel: Routes ────────────────────────────────────────────────
  const routesPanel=mk('div',{id:'sb-panel-routes',class:'sb-panel'});
  buildRoutesPanel(routesPanel);
  sidebar.appendChild(routesPanel);

  // ── Hint ─────────────────────────────────────────────────────────
  sidebar.appendChild(sep({id:'sb-sep-hint'}));
  const hint=mk('div',{id:'sb-hint'});
  const updateHint=()=>{ hint.innerHTML=isMobile()?`<span class="sb-hint-icon">👆</span><span class="sb-hint-text"><strong>Tap</strong> a collectable marker to mark it complete</span>`:`<span class="sb-hint-icon">🖱️</span><span class="sb-hint-text"><strong>Right-click</strong> a collectable to mark it complete</span>`; };
  updateHint(); window.addEventListener('resize',updateHint);
  sidebar.appendChild(hint);
  document.body.appendChild(sidebar);

  // ── Toggle arrow — body child, positioned after sidebar transition ──
  const toggle = mk('button',{id:'sb-toggle'});
  toggle.innerHTML = '▶';
  document.body.appendChild(toggle);

  function positionToggle() {
    toggle.style.right = sidebarOpen ? sidebar.offsetWidth + 'px' : '0px';
  }

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
  let sidebarOpen = savedView !== 'closed';
  function saveView() { localStorage.setItem('sbView', !sidebarOpen ? 'closed' : isCompact() ? 'compact' : 'full'); }
  function sbW() { return sidebar.offsetWidth || (isCompact() ? 52 : (isMobile() ? 310 : 350)); }
  function applyLayout(animate) {
    if (!animate) sidebar.style.transition = 'none';
    sidebar.style.transform = sidebarOpen ? '' : `translateX(${sbW()}px)`;
    toggle.innerHTML = sidebarOpen ? '▶' : '◀';
    floatWrap.style.display = sidebarOpen ? 'none' : 'flex';
    positionToggle();
    if (!animate) requestAnimationFrame(() => { sidebar.style.transition = ''; });
  }
  toggle.addEventListener('click',()=>{sidebarOpen=!sidebarOpen;saveView();applyLayout(true);});
  btnTV.addEventListener('click',()=>{
    sidebar.classList.toggle('compact'); updateViewBtn(); saveView();
    applyLayout(true);
    // Re-run after transition so offsetWidth reflects new compact width
    sidebar.addEventListener('transitionend', () => applyLayout(false), {once:true});
  });
  applyLayout(false);
  window.addEventListener('resize',()=>{ applyLayout(false); positionToggle(); });

  // ── Checkboxes (full filter panel) ──────────────────────────────
  document.querySelectorAll('#sb-cat-list input[type="checkbox"]').forEach(cb=>{
    cb.addEventListener('change',e=>{
      const n=e.target.dataset.layer;
      if(!hiddenGroups.has(n)){e.target.checked?map.addLayer(layers[n]):map.removeLayer(layers[n]);}
      updateLocalStorage();
      updateMultiFactionIcons();
    });
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
  let allCats;
  if (group.hasSub) {
    allCats = [...Object.keys(PLANT_SUBS), ...Object.keys(ORE_SUBS)];
  } else if (group.hasMobSub) {
    allCats = [...group.cats, ...Object.keys(MOB_FACTIONS), 'Mobs'];
  } else {
    allCats = group.cats;
  }
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
      document.querySelectorAll(`input[data-layer="${cat}"]`).forEach(cb=>{ cb.checked=true; cb.closest('.compact-cat-row')?.classList.add('checked'); });
      if (layers[cat]) map.addLayer(layers[cat]);
    }
  });
  updateLocalStorage();
}

// ─── Route share codes ────────────────────────────────────────────────────────
function encodeRouteCode(route) {
  const c = (route.colour||'#e74c3c').replace('#','');
  const r3 = Math.round(parseInt(c.slice(0,2),16)/17).toString(16);
  const g3 = Math.round(parseInt(c.slice(2,4),16)/17).toString(16);
  const b3 = Math.round(parseInt(c.slice(4,6),16)/17).toString(16);
  const colCode = r3+g3+b3;
  // Delta encode: store first point then differences, rounded to nearest 2 units
  const pts = route.points;
  const first = [Math.round(pts[0][0]/2), Math.round(pts[0][1]/2)];
  const deltas = [first[0]+','+first[1]];
  for (let i=1;i<pts.length;i++) {
    const da = Math.round(pts[i][0]/2) - Math.round(pts[i-1][0]/2);
    const db = Math.round(pts[i][1]/2) - Math.round(pts[i-1][1]/2);
    deltas.push(da+','+db);
  }
  const raw = colCode+'|'+deltas.join(';');
  return btoa(raw).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}
function decodeRouteCode(code) {
  try {
    const padded = code.replace(/-/g,'+').replace(/_/g,'/');
    const raw = atob(padded + '=='.slice(0,(4-padded.length%4)%4));
    const pipe = raw.indexOf('|');
    const colCode = raw.slice(0,pipe), ptsStr = raw.slice(pipe+1);
    const r=parseInt(colCode[0],16)*17, g=parseInt(colCode[1],16)*17, b=parseInt(colCode[2],16)*17;
    const colour = '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
    const deltas = ptsStr.split(';').map(s=>s.split(',').map(Number));
    if (!deltas.length) return null;
    const points = [[deltas[0][0]*2, deltas[0][1]*2]];
    for (let i=1;i<deltas.length;i++) {
      const prev = [Math.round(points[i-1][0]/2), Math.round(points[i-1][1]/2)];
      points.push([(prev[0]+deltas[i][0])*2, (prev[1]+deltas[i][1])*2]);
    }
    if (points.length<2) return null;
    // Try legacy format (flat coords, no delta) if points look wrong
    return {colour, points, note:''};
  } catch { return null; }
}

// ─── Routes Panel ─────────────────────────────────────────────────────────────
function buildRoutesPanel(panel) {
  panel.innerHTML = '';

  // ── Hint ──────────────────────────────────────────────────────────
  const hint = mk('div',{class:'cust-mode-status',style:'font-size:0.74em;font-weight:700;color:#f0a040;padding:0.2em 0;flex-shrink:0;'});
  hint.textContent = 'Hold & drag on the map to draw a route';

  // ── Name input ────────────────────────────────────────────────────
  const nameRow = mk('div',{style:'display:flex;gap:0.35em;align-items:center;'});
  const nameLabel = mk('span',{style:'font-size:0.78em;font-weight:700;color:#3a2e1e;white-space:nowrap;'}); nameLabel.textContent='Name:';
  const nameInput = mk('input'); Object.assign(nameInput,{type:'text',placeholder:'e.g. Ore run, Chest route…',style:'flex:1;padding:0.32em 0.5em;border:1.5px solid #a09880;border-radius:4px;font-family:Noto,sans-serif;font-size:0.8em;background:rgb(232,228,218);color:#1a1a1a;outline:none;'});
  nameRow.appendChild(nameLabel); nameRow.appendChild(nameInput);

  // ── Draw / Visible buttons ────────────────────────────────────────
  const modeRow = mk('div',{class:'cust-mode-row'});
  const btnRoute = mk('button',{class:'cust-btn cust-btn-route'}); btnRoute.innerHTML=`${SVG.route} Draw Route`;
  const btnFinish = mk('button',{class:'cust-btn cust-btn-route',style:'display:none'}); btnFinish.textContent='✓ Finish';
  const btnCancel = mk('button',{class:'cust-btn cust-btn-cancel',style:'display:none'}); btnCancel.textContent='✕ Cancel';
  modeRow.appendChild(btnRoute); modeRow.appendChild(btnFinish); modeRow.appendChild(btnCancel);

  const visRow = mk('div',{class:'cust-mode-row',style:'margin-top:0.3em;'});
  const btnVis = mk('button',{class:`cust-btn cust-btn-route${routesVisible?' active':''}`,style:'flex:1;'});
  btnVis.textContent = routesVisible?'👁 Routes Visible':'👁 Routes Hidden';
  btnVis.addEventListener('click',()=>{
    routesVisible=!routesVisible; localStorage.setItem('routesVisible',routesVisible?'1':'0');
    btnVis.classList.toggle('active',routesVisible);
    btnVis.textContent=routesVisible?'👁 Routes Visible':'👁 Routes Hidden';
    renderRoutes(); refreshRouteList();
  });
  visRow.appendChild(btnVis);

  function saveRouteWithName() {
    const name = nameInput.value.trim();
    if (name && customRoutes.length) { customRoutes[customRoutes.length-1].note = name; saveCustom(); }
    nameInput.value = '';
  }
  function showRouteControls() {
    btnRoute.style.display = 'none';
    btnFinish.style.display = '';
    btnCancel.style.display = '';
  }
  function hideRouteControls() {
    btnRoute.style.display = '';
    btnFinish.style.display = 'none';
    btnCancel.style.display = 'none';
  }
  // Called by desktop mouseup — pause drawing, show Finish/Cancel
  window._showDesktopRouteControls = showRouteControls;

  btnRoute.addEventListener('click', () => {
    routeDrawing = true; routePoints = []; pendingCustPlace = false;
    if (isMobile()) { showRouteControls(); showMobileRouteBar(); }
    else { updateCustModeStatus('Hold & drag on map to draw — release then click Finish'); }
  });
  btnFinish.addEventListener('click', () => {
    finishRoute(); routeDrawing = false;
    hideRouteControls();
    hideMobileRouteBar(true); saveRouteWithName(); refreshRouteList();
  });
  btnCancel.addEventListener('click', () => {
    routeDrawing = false; routePoints = []; routeDrawActive = false;
    if (routePreviewLayer) { map.removeLayer(routePreviewLayer); routePreviewLayer = null; }
    hideRouteControls();
    hideMobileRouteBar(true);
    updateCustModeStatus('Hold & drag on the map to draw a route');
  });
  window._onRouteFinished = () => { saveRouteWithName(); refreshRouteList(); };

  // ── New route colour picker ───────────────────────────────────────
  const colTitle=mk('div',{class:'cust-section-title'}); colTitle.textContent='New Route Colour';
  const colRow=mk('div',{class:'color-swatch-row'});
  let selSwatch=null;
  CUSTOM_COLOURS.forEach(col=>{
    const s=mk('div',{class:'color-swatch'+(col===selectedCustColour?' selected':'')}); s.style.background=col;
    s.addEventListener('click',()=>{ selectedCustColour=col; localStorage.setItem('custColour',col); selSwatch?.classList.remove('selected'); s.classList.add('selected'); selSwatch=s; });
    if(col===selectedCustColour) selSwatch=s;
    colRow.appendChild(s);
  });

  // ── Global opacity slider ─────────────────────────────────────────
  const opTitle=mk('div',{class:'cust-section-title'}); opTitle.textContent='All Routes Opacity';
  const opRow=mk('div',{style:'display:flex;align-items:center;gap:0.5em;'});
  const opSlider=mk('input'); Object.assign(opSlider,{type:'range',min:'0.05',max:'1',step:'0.01',value:String(globalRouteOpacity),style:'flex:1;cursor:pointer;accent-color:rgb(210,120,0);'});
  const opVal=mk('span',{style:'font-size:0.75em;color:#555;width:2.8em;text-align:right;flex-shrink:0;'}); opVal.textContent=Math.round(globalRouteOpacity*100)+'%';
  opSlider.addEventListener('input',()=>{ globalRouteOpacity=parseFloat(opSlider.value); opVal.textContent=Math.round(globalRouteOpacity*100)+'%'; localStorage.setItem('routeOpacity',globalRouteOpacity); renderRoutes(); });
  opRow.appendChild(opSlider); opRow.appendChild(opVal);

  // ── Route list ────────────────────────────────────────────────────
  const listTitle=mk('div',{class:'cust-section-title',id:'route-list-title'}); listTitle.textContent=`My Routes (${customRoutes.length})`;
  const routeList=mk('div',{id:'route-list',style:'display:flex;flex-direction:column;'});

  function refreshRouteList() {
    listTitle.textContent=`My Routes (${customRoutes.length})`;
    routeList.innerHTML='';
    if(!customRoutes.length){ const e=mk('div',{style:'font-size:0.78em;color:#888;padding:0.4em 0;'}); e.textContent='No routes yet — draw one above'; routeList.appendChild(e); return; }
    customRoutes.forEach((rt,i)=>{
      const row=mk('div',{style:'background:rgb(225,220,210);border-radius:5px;padding:0.45em 0.6em;border:1px solid #c0b898;margin-bottom:0.3em;'});

      // Top: visibility check + editable name + sort + fly + delete
      const topRow=mk('div',{style:'display:flex;align-items:center;gap:0.3em;'});
      // Visibility checkbox (check0/check1 png)
      const visChk=mk('span',{style:`background-image:url("${rt.hidden?'check0':'check1'}.png");background-size:contain;background-repeat:no-repeat;width:1.05em;height:1.05em;flex-shrink:0;cursor:pointer;`});
      visChk.addEventListener('click',()=>{ rt.hidden=!rt.hidden; saveCustom(); renderRoutes(); refreshRouteList(); });
      // Colour dot — click to expand inline swatch row below
      const colDot=mk('div',{style:`width:16px;height:16px;border-radius:50%;background:${rt.colour||'#e74c3c'};flex-shrink:0;cursor:pointer;border:2px solid rgba(0,0,0,0.25);`});
      colDot.title='Click to change colour';
      const colSwatchRow=mk('div',{style:'display:none;flex-wrap:wrap;gap:0.25em;margin-top:0.3em;'});
      CUSTOM_COLOURS.forEach(col=>{
        const sw=mk('div',{style:`width:1.3em;height:1.3em;border-radius:3px;background:${col};cursor:pointer;border:2px solid ${col===(rt.colour||'#e74c3c')?'#1a1a1a':'transparent'};flex-shrink:0;`});
        sw.addEventListener('click',()=>{ rt.colour=col; saveCustom(); renderRoutes(); refreshRouteList(); });
        colSwatchRow.appendChild(sw);
      });
      colDot.addEventListener('click',e=>{ e.stopPropagation(); colSwatchRow.style.display=colSwatchRow.style.display==='none'?'flex':'none'; });

      const nameInp=mk('input'); Object.assign(nameInp,{type:'text',value:rt.note||`Route ${i+1}`,style:'flex:1;padding:0.2em 0.4em;border:1px solid #a09880;border-radius:3px;font-size:0.79em;background:transparent;color:#3a2e1e;outline:none;font-weight:600;cursor:text;min-width:0;'});
      nameInp.addEventListener('change',()=>{ rt.note=nameInp.value.trim()||`Route ${i+1}`; saveCustom(); });
      const upBtn=mk('button',{style:'background:none;border:none;cursor:pointer;color:#555;font-size:0.8em;padding:0.1em;'}); upBtn.textContent='↑';
      upBtn.addEventListener('click',()=>{ if(i>0){[customRoutes[i-1],customRoutes[i]]=[customRoutes[i],customRoutes[i-1]]; saveCustom(); renderRoutes(); refreshRouteList();} });
      const dnBtn=mk('button',{style:'background:none;border:none;cursor:pointer;color:#555;font-size:0.8em;padding:0.1em;'}); dnBtn.textContent='↓';
      dnBtn.addEventListener('click',()=>{ if(i<customRoutes.length-1){[customRoutes[i],customRoutes[i+1]]=[customRoutes[i+1],customRoutes[i]]; saveCustom(); renderRoutes(); refreshRouteList();} });
      const flyBtn=mk('button',{style:'background:none;border:none;cursor:pointer;color:#388e9f;font-size:0.85em;padding:0.1em 0.2em;'}); flyBtn.title='Go to route'; flyBtn.textContent='🎯';
      flyBtn.addEventListener('click',()=>{ if(rt.points.length) map.flyTo(rt.points[0],0,{animate:true,duration:0.7}); });
      const delBtn=mk('button',{style:'background:none;border:none;cursor:pointer;color:#c0392b;font-size:0.8em;padding:0.1em 0.2em;'}); delBtn.innerHTML=SVG.trash;
      delBtn.addEventListener('click',()=>{ customRoutes.splice(i,1); saveCustom(); renderRoutes(); refreshRouteList(); });
      topRow.appendChild(visChk); topRow.appendChild(colDot); topRow.appendChild(nameInp); topRow.appendChild(upBtn); topRow.appendChild(dnBtn); topRow.appendChild(flyBtn); topRow.appendChild(delBtn);

      // Share code row
      const code=encodeRouteCode(rt);
      const codeRow=mk('div',{style:'display:flex;align-items:center;gap:0.3em;margin-top:0.3em;'});
      const codeBox=mk('input'); Object.assign(codeBox,{type:'text',readOnly:true,value:code,title:'Click to copy',style:'flex:1;padding:0.2em 0.4em;border:1px solid #a09880;border-radius:3px;font-size:0.68em;background:rgb(215,210,200);color:#3a2e1e;outline:none;cursor:pointer;'});
      codeBox.addEventListener('click',()=>{ navigator.clipboard?.writeText(code).then(()=>{ codeBox.style.background='rgb(200,230,200)'; setTimeout(()=>codeBox.style.background='',1000); }); });
      codeRow.appendChild(codeBox);

      row.appendChild(topRow); row.appendChild(colSwatchRow); row.appendChild(codeRow);
      routeList.appendChild(row);
    });
  }
  window._routeRenderHook=()=>refreshRouteList();

  // ── Import ────────────────────────────────────────────────────────
  const importTitle=mk('div',{class:'cust-section-title'}); importTitle.textContent='Import Route';
  const importRow=mk('div',{style:'display:flex;gap:0.3em;'});
  const importInput=mk('input'); Object.assign(importInput,{type:'text',placeholder:'Paste route code…',style:'flex:1;padding:0.32em 0.5em;border:1.5px solid #a09880;border-radius:4px;font-family:Noto,sans-serif;font-size:0.8em;background:rgb(232,228,218);color:#1a1a1a;outline:none;'});
  const importBtn=mk('button',{style:'padding:0.32em 0.7em;border-radius:4px;border:none;background:rgb(120,90,55);color:white;font-family:Noto,sans-serif;font-size:0.78em;font-weight:700;cursor:pointer;white-space:nowrap;'}); importBtn.textContent='Import';
  const importStatus=mk('div',{style:'font-size:0.72em;min-height:1em;color:#5a4a2a;'});
  importBtn.addEventListener('click',()=>{
    const rt=decodeRouteCode(importInput.value.trim());
    if(!rt){ importStatus.textContent='❌ Invalid code'; importStatus.style.color='#c0392b'; return; }
    customRoutes.push(rt); saveCustom(); renderRoutes(); refreshRouteList();
    importInput.value=''; importStatus.textContent='✓ Route imported!'; importStatus.style.color='#27ae60';
    setTimeout(()=>importStatus.textContent='',3000);
  });
  importRow.appendChild(importInput); importRow.appendChild(importBtn);

  panel.appendChild(hint);
  panel.appendChild(nameRow); panel.appendChild(modeRow); panel.appendChild(visRow);
  panel.appendChild(sep());
  panel.appendChild(colTitle); panel.appendChild(colRow);
  panel.appendChild(sep());
  panel.appendChild(opTitle); panel.appendChild(opRow);
  panel.appendChild(sep());
  panel.appendChild(listTitle); panel.appendChild(routeList);
  panel.appendChild(sep());
  panel.appendChild(importTitle); panel.appendChild(importRow); panel.appendChild(importStatus);

  // Delete All Routes
  panel.appendChild(sep());
  const delAllBtn = mk('button',{style:'width:100%;padding:0.5em;border-radius:5px;border:none;background:linear-gradient(135deg,#b0665d 50%,#ce715c 50%);color:white;font-family:Noto,sans-serif;font-size:0.88em;font-weight:700;cursor:pointer;'});
  delAllBtn.textContent = '🗑 Delete All Routes';
  const delAllStatus = mk('div',{style:'font-size:0.75em;text-align:center;min-height:1.2em;margin-top:0.3em;'});
  let delAllPending = false;
  delAllBtn.addEventListener('click', () => {
    if (!delAllPending) {
      delAllPending = true;
      delAllBtn.textContent = '⚠️ Are you sure? Click again to confirm';
      delAllBtn.style.background = 'linear-gradient(135deg,#8a3030 50%,#a03030 50%)';
      setTimeout(() => {
        if (delAllPending) {
          delAllPending = false;
          delAllBtn.textContent = '🗑 Delete All Routes';
          delAllBtn.style.background = 'linear-gradient(135deg,#b0665d 50%,#ce715c 50%)';
        }
      }, 4000);
    } else {
      delAllPending = false;
      customRoutes.length = 0;
      saveCustom(); renderRoutes(); refreshRouteList();
      delAllBtn.textContent = '🗑 Delete All Routes';
      delAllBtn.style.background = 'linear-gradient(135deg,#b0665d 50%,#ce715c 50%)';
      delAllStatus.textContent = '✓ All routes deleted';
      delAllStatus.style.color = '#27ae60';
      setTimeout(() => delAllStatus.textContent = '', 3000);
    }
  });
  panel.appendChild(delAllBtn);
  panel.appendChild(delAllStatus);

  refreshRouteList();
}

function buildCustomPanel(panel) {
  panel.innerHTML='';

  // Status hint — always on top, never behind grid
  const statusEl=mk('div',{class:'cust-mode-status',id:'cust-mode-status'});
  statusEl.style.cssText='font-size:0.74em;font-weight:700;color:#f0a040;min-height:1.6em;padding:0.2em 0;flex-shrink:0;';
  statusEl.textContent='Select an icon then click the map to place it';

  // Icon grid
  const iconGrid=mk('div',{class:'cust-icon-grid'});
  let selIconBtn=null;
  CUSTOM_ICONS.forEach(ic=>{
    const b=mk('div',{class:'cust-icon-btn'}); b.textContent=ic;
    b.addEventListener('click',()=>{
      if(selIconBtn===b && pendingCustPlace){
        pendingCustPlace=false; b.classList.remove('selected'); selIconBtn=null;
        updateCustModeStatus('Select an icon then click the map to place it');
        return;
      }
      selectedCustIcon=ic; localStorage.setItem('custIcon',ic);
      selIconBtn?.classList.remove('selected'); b.classList.add('selected'); selIconBtn=b;
      pendingCustPlace=true; updateCustModeStatus(`Click map to place ${ic} — tap again to cancel`);
    });
    iconGrid.appendChild(b);
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

  panel.appendChild(statusEl);
  panel.appendChild(iconGrid);
}

// ─── Build category row ───────────────────────────────────────────────────────
function buildCatRow(name, layers, iconOverride) {
  const colour = COLOURS[name]||'#ffa958';
  const iconUrl = iconOverride || ICONS[name];
  const total = categoryRegistry[name]?.total||0;
  const row = mk('label',{class:'sb-cat-row'}); row.setAttribute('data-tip',name);
  const indicator = iconUrl
    ? `<img src="${iconUrl}" class="sb-cat-icon" alt="">`
    : `<span class="sb-cat-dot-wrap"><span class="sb-cat-dot" style="background:${colour}"></span></span>`;
  const isCollectable = COMPLETABLE.has(name);
  row.innerHTML=`<input type="checkbox" data-layer="${name}" class="category" style="display:none"><span class="sb-check-img"></span>${indicator}<span class="sb-cat-name" style="color:${colour}">${name}</span><span class="sb-cat-count" data-cat="${name}">${isCollectable?`0/${total}`:total}</span>`;
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
function updateMultiFactionIcons() {
  const checkedFactions = new Set(
    [...document.querySelectorAll('#sb-cat-list input[type="checkbox"].category')]
      .filter(cb => cb.checked && MOB_FACTIONS[cb.dataset.layer])
      .map(cb => cb.dataset.layer)
  );
  allMarkers.forEach(({marker}) => {
    if (!marker._allFactions || !marker._makeMultiIcon) return;
    const visible = marker._allFactions.filter(f => checkedFactions.has(f));
    if (visible.length === 0) {
      // No faction selected — hide marker
      if (map.hasLayer(marker)) map.removeLayer(marker);
    } else {
      // Show marker with icon of visible factions only
      marker.setIcon(marker._makeMultiIcon(visible));
      if (!map.hasLayer(marker)) marker.addTo(map);
    }
  });
}
function updateCounts() {
  Object.keys(categoryRegistry).forEach(cat => {
    const reg = categoryRegistry[cat];
    const el = document.querySelector(`.sb-cat-count[data-cat="${cat}"]`); if(!el) return;
    if (COMPLETABLE.has(cat)) {
      const done = reg.markerIds.filter(id => completedMarkers.has(id)).length;
      el.textContent = `${done}/${reg.total}`;
      el.style.color = done===reg.total&&reg.total>0 ? '#27ae60' : done>0 ? '#e67e22' : '#777';
      el.style.fontWeight = done>0 ? 'bold' : 'normal';
    } else {
      el.textContent = reg.total;
      el.style.color = '#777';
      el.style.fontWeight = 'normal';
    }
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
  const sb = document.getElementById('sidebar');
  if(sb) { const w = sb.offsetWidth || 310; sb.style.transform = `translateX(${w}px)`; }
  const bar = mk('div',{id:'mobile-route-bar'});
  bar.style.cssText=`position:fixed;bottom:0;left:0;right:0;z-index:1200;display:flex;gap:0.5em;padding:0.75em 1em;background:linear-gradient(135deg,#785a37 50%,#8e6a41 50%);box-shadow:0 -3px 12px rgba(0,0,0,0.3);`;
  const label=mk('span'); label.style.cssText='color:white;font-size:0.82em;font-weight:700;flex:1;display:flex;align-items:center;'; label.textContent='Hold & drag to draw route';
  const finBtn=mk('button'); finBtn.style.cssText='padding:0.5em 1em;border-radius:6px;border:none;background:linear-gradient(135deg,#4c9da8 50%,#74babe 50%);color:white;font-weight:700;font-size:0.82em;cursor:pointer;';
  finBtn.textContent='✓ Finish';
  const canBtn=mk('button'); canBtn.style.cssText='padding:0.5em 0.8em;border-radius:6px;border:none;background:linear-gradient(135deg,#b0665d 50%,#ce715c 50%);color:white;font-weight:700;font-size:0.82em;cursor:pointer;';
  canBtn.textContent='✕ Cancel';
  finBtn.addEventListener('click',()=>{ finishRoute(); routeDrawing=false; hideMobileRouteBar(true); });
  canBtn.addEventListener('click',()=>{ routeDrawing=false; routePoints=[]; routeDrawActive=false; if(routePreviewLayer){map.removeLayer(routePreviewLayer);routePreviewLayer=null;} hideMobileRouteBar(true); });
  bar.appendChild(label); bar.appendChild(finBtn); bar.appendChild(canBtn);
  document.body.appendChild(bar);
}
function hideMobileRouteBar(reopenSidebar) {
  document.getElementById('mobile-route-bar')?.remove();
  if (reopenSidebar) {
    const sb = document.getElementById('sidebar');
    if(sb) sb.style.transform = '';
  }
}

loadData();
