/* ============ DATA ============ */
/* DATA and MAP_POINTS_DEFAULT are injected above this file */

const LS = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};

function parseTripDate(d){
  const [dd,mm,yy] = d.split('.').map(Number);
  return new Date(2000+yy, mm-1, dd);
}
function fmtDateShort(d){
  return parseTripDate(d).toLocaleDateString('en-US', {day:'numeric', month:'short'});
}
function fmtDateLine(d){
  return parseTripDate(d).toLocaleDateString('en-US', {weekday:'long', month:'short', day:'numeric'}).toUpperCase();
}
function isoDate(d){
  const dt = parseTripDate(d);
  return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
}

function defaultDayIndex(){
  const now = new Date(); now.setHours(0,0,0,0);
  for(let i=0;i<DATA.length;i++){
    if(parseTripDate(DATA[i].date) >= now) return i;
  }
  return 0;
}
let currentDay = defaultDayIndex();

function esc(s){ return (s||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ============ TAB SWITCHING ============ */
function showView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+name).classList.add('active');
  document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.toggle('active', b.dataset.view===name));
  if(name==='map' && window._leafletMap){ setTimeout(()=>window._leafletMap.invalidateSize(), 60); }
  window.scrollTo({top:0});
}
document.querySelectorAll('nav.tabs button').forEach(b=>{
  b.addEventListener('click', ()=>showView(b.dataset.view));
});

/* ============ CITY KANJI + COORDS ============ */
const CITY_KANJI = { Tokyo:'東京', Kyoto:'京都', Osaka:'大阪', Nara:'奈良', Hakone:'箱根', Israel:'イスラエル' };
const CITY_COORDS = {
  Tokyo:[35.6812,139.7671], Kyoto:[35.0116,135.7681], Osaka:[34.6937,135.5023],
  Nara:[34.6851,135.8048], Hakone:[35.2323,139.1069]
};

/* ============ EVENT TYPE ============ */
function typeGuess(ev){
  if(ev && ev.type) return ev.type;
  return 'activity';
}
const ICONS = {
  flight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="M2 14.5l19-7-6 6.5 1.5 7-3.5-4-3 3-1-4-4-1.5 3-3z"/></svg>',
  drive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="M4 16h16M5 16l1.5-5a2 2 0 0 1 2-1.5h7a2 2 0 0 1 2 1.5L19 16M5 16v2.2M19 16v2.2"/><circle cx="7.5" cy="17.7" r="1.3"/><circle cx="16.5" cy="17.7" r="1.3"/></svg>',
  stay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="M3 18v-7.5A1.5 1.5 0 0 1 4.5 9H12a1.5 1.5 0 0 1 1.5 1.5V13"/><path d="M3 13h17.5A1.5 1.5 0 0 1 22 14.5V18M3 18v2M22 18v2"/><ellipse cx="7" cy="11.3" rx="1.6" ry="1.1"/></svg>',
  bar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="M5 5h14l-6.2 7.5v6M12.8 18.5H9.2M4 5.2c1.5 2 2.6 2.9 4 2.9M20 5.2c-1.5 2-2.6 2.9-4 2.9"/></svg>',
  meal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="M3.5 11.5h17c0 4-3.6 7-8.5 7s-8.5-3-8.5-7z"/><path d="M9 8c-.6-1 .3-2 0-3.2M12 8c-.6-1 .3-2 0-3.2M15 8c-.6-1 .3-2 0-3.2"/></svg>',
  shopping: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="M6.5 8h11l1 12h-13z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>',
  activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="M2.5 8h19M5 8l1-3.2h12L19 8M7 8v11M17 8v11M4 19h16"/></svg>'
};
const TYPE_META = {
  flight:{label:'Flight'}, drive:{label:'Transit'}, stay:{label:'Hotel'},
  bar:{label:'Bar'}, meal:{label:'Food'}, shopping:{label:'Shopping'}, activity:{label:'Activity'}
};

/* ============ TAGLINES ============ */
function dayTagline(day, idx){
  const acts = day.events.map(e=>e.activity.toLowerCase()).join(' | ');
  if(idx===0) return 'Wheels up — flight day to Japan';
  if(idx===DATA.length-1) return 'Last hours in Japan before the flight home';
  const prevCity = DATA[idx-1].city;
  if(acts.includes('arriving') && prevCity !== day.city) return `Touchdown — first steps in ${day.city}`;
  const lastCity = day.events.filter(e=>e.city).map(e=>e.city).pop();
  if(lastCity && lastCity !== day.city && idx<DATA.length-1) return `Onward from ${day.city} to ${lastCity}`;
  if(/temple|shrine|taisha|-ji\b/.test(acts)) return `Temples and quiet corners of ${day.city}`;
  if(/market|flea/.test(acts)) return `Markets, matcha, and wandering ${day.city}`;
  if(/onsen|hotel|relax/.test(acts)) return `Slowing down in ${day.city}`;
  if(/bar -|bar,|izakaya/.test(acts)) return `An evening deep dive into ${day.city}`;
  return `A day exploring ${day.city}`;
}

/* ============ WEATHER ENGINE ============ */
const WMO = {
  0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',
  51:'🌦️',53:'🌦️',55:'🌦️',56:'🌦️',57:'🌦️',
  61:'🌧️',63:'🌧️',65:'🌧️',66:'🌧️',67:'🌧️',
  71:'❄️',73:'❄️',75:'❄️',77:'❄️',80:'🌦️',81:'🌦️',82:'🌧️',
  95:'⛈️',96:'⛈️',99:'⛈️'
};
const WMO_LABEL = {
  0:'Clear sky',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',48:'Foggy',
  51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',56:'Freezing drizzle',57:'Freezing drizzle',
  61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Freezing rain',
  71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Rain showers',81:'Rain showers',82:'Heavy showers',
  95:'Thunderstorm',96:'Thunderstorm',99:'Thunderstorm'
};
function wmoIcon(code){ return WMO[code] || '🌤️'; }

const WeatherEngine = (function(){
  const CACHE_KEY = 'jtrip_weather_v2';
  let cache = LS.get(CACHE_KEY, {});
  const HOUR = 3600*1000;

  function save(){ LS.set(CACHE_KEY, cache); }

  async function fetchJSON(url){
    const res = await fetch(url);
    if(!res.ok) throw new Error('bad response');
    return res.json();
  }

  async function ensureForecast(city, lat, lon, dates){
    const c = cache[city] = cache[city] || {};
    const now = Date.now();
    if(c.forecast && (now - c.forecast.fetchedAt) < 12*HOUR) return;
    if(!dates.length) return;
    const start = dates[0], end = dates[dates.length-1];
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=Asia%2FTokyo&start_date=${start}&end_date=${end}`;
    try{
      const j = await fetchJSON(url);
      const byDate = {};
      j.daily.time.forEach((d,i)=>{
        byDate[d] = { max:j.daily.temperature_2m_max[i], min:j.daily.temperature_2m_min[i], code:j.daily.weathercode[i] };
      });
      c.forecast = { byDate, fetchedAt: now };
      save();
    }catch(e){ /* offline or blocked — keep whatever is cached */ }
  }

  async function ensureHistorical(city, lat, lon){
    const c = cache[city] = cache[city] || {};
    const now = Date.now();
    if(c.historical && (now - c.historical.fetchedAt) < 30*24*HOUR) return;
    const thisYear = new Date().getFullYear();
    const years = [thisYear-5,thisYear-4,thisYear-3,thisYear-2,thisYear-1];
    try{
      const results = await Promise.all(years.map(y=>{
        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${y}-09-25&end_date=${y}-11-05&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=Asia%2FTokyo`;
        return fetchJSON(url).catch(()=>null);
      }));
      const records = [];
      results.forEach(j=>{
        if(!j || !j.daily) return;
        j.daily.time.forEach((d,i)=>{
          const [,m,day] = d.split('-').map(Number);
          records.push({ m, day, max:j.daily.temperature_2m_max[i], min:j.daily.temperature_2m_min[i], code:j.daily.weathercode ? j.daily.weathercode[i] : null });
        });
      });
      if(records.length){
        c.historical = { records, fetchedAt: now };
        save();
      }
    }catch(e){ /* ignore */ }
  }

  async function init(){
    const now = new Date(); now.setHours(0,0,0,0);
    const horizon = new Date(now); horizon.setDate(horizon.getDate()+15);
    const byCity = {};
    DATA.forEach(day=>{
      const city = day.city;
      if(!CITY_COORDS[city]) return;
      byCity[city] = byCity[city] || {forecastDates:[], needHistorical:false};
      const dt = parseTripDate(day.date);
      if(dt <= horizon && dt >= now){ byCity[city].forecastDates.push(isoDate(day.date)); }
      else if(dt > horizon){ byCity[city].needHistorical = true; }
    });
    const tasks = [];
    Object.keys(byCity).forEach(city=>{
      const [lat,lon] = CITY_COORDS[city];
      const info = byCity[city];
      if(info.forecastDates.length) tasks.push(ensureForecast(city, lat, lon, info.forecastDates));
      if(info.needHistorical) tasks.push(ensureHistorical(city, lat, lon));
    });
    await Promise.allSettled(tasks);
  }

  function getForDay(date, city){
    const c = cache[city];
    if(!c) return null;
    const iso = isoDate(date);
    if(c.forecast && c.forecast.byDate[iso]){
      const f = c.forecast.byDate[iso];
      return { max:Math.round(f.max), min:Math.round(f.min), icon: wmoIcon(f.code), code:f.code, source:'forecast' };
    }
    if(c.historical){
      const dt = parseTripDate(date);
      const m = dt.getMonth()+1, d = dt.getDate();
      const matches = c.historical.records.filter(r => r.m===m && Math.abs(r.day-d)<=2);
      if(matches.length){
        const avg = arr => arr.reduce((a,b)=>a+b,0)/arr.length;
        const codeCounts = {};
        matches.forEach(r=>{ if(r.code!=null) codeCounts[r.code] = (codeCounts[r.code]||0)+1; });
        let modeCode = null, best = 0;
        Object.entries(codeCounts).forEach(([code,ct])=>{ if(ct>best){ best=ct; modeCode=Number(code); } });
        return { max:Math.round(avg(matches.map(r=>r.max))), min:Math.round(avg(matches.map(r=>r.min))), icon:'🍂', code:modeCode, source:'avg' };
      }
    }
    return null;
  }

  return { init, getForDay };
})();

/* ============ TODAY VIEW ============ */
function renderDayChips(){
  const wrap = document.getElementById('dayChips');
  wrap.innerHTML = DATA.map((d,i)=>`<button class="daychip ${i===currentDay?'active':''}" data-i="${i}">D${i+1}</button>`).join('');
  wrap.querySelectorAll('.daychip').forEach(btn=>{
    btn.addEventListener('click', ()=>{ currentDay = Number(btn.dataset.i); renderToday(); scrollChipIntoView(); });
  });
  scrollChipIntoView();
}
function scrollChipIntoView(){
  const wrap = document.getElementById('dayChips');
  const active = wrap.querySelector('.daychip.active');
  if(active && typeof active.scrollIntoView === 'function'){
    try{ active.scrollIntoView({inline:'center', block:'nearest'}); }catch(e){}
  }
}

function weatherPillHTML(w){
  if(!w) return '';
  const lab = w.source==='forecast' ? 'Forecast' : `${w.source==='avg'?'Typical for this date':'Forecast'} \u00B7 5yr avg`;
  return `<div class="wx"><div class="t">${w.icon} ${w.max}\u00B0<span class="lo">/${w.min}\u00B0</span></div><div class="l">${w.source==='avg'?'seasonal avg':'forecast'}</div></div>`;
}

function weatherDetailHTML(w, city){
  if(!CITY_COORDS[city]) return '';
  if(!w) return `<div class="wx-detail wx-loading">🍂 Checking the weather for ${esc(city)}…</div>`;
  const cond = WMO_LABEL[w.code] || (w.source==='avg' ? 'Seasonal average' : 'Mixed conditions');
  const srcLabel = w.source==='forecast' ? 'Live forecast' : 'Typical for this date (5-year average)';
  return `<div class="wx-detail">
    <div class="wx-icon">${w.icon}</div>
    <div class="wx-body">
      <div class="wx-temps"><b>${w.max}\u00B0</b> <span class="lo">/ ${w.min}\u00B0</span> <span class="wx-cond">${esc(cond)}</span></div>
      <div class="wx-src">${srcLabel} \u00B7 ${esc(city)}</div>
    </div>
  </div>`;
}

const DAY_TYPE_COLOR = {
  flight:'#3B4A63', drive:'#5B6B7A', stay:'#B4872A', bar:'#7C5980', meal:'#A3402E', shopping:'#2F7A6E', activity:'#56705B'
};
const KML_CAT_COLOR = {
  'Bars':'#7C5980','Cafes & Matcha':'#56705B','Casual Food':'#C1652B','Museums & Parks':'#3B4A63',
  'Bakeries & Sweets':'#C77B9A','Shops':'#B4872A','Restaurants':'#A3402E','Markets':'#8A6A3D',
  'Must-See':'#D4A83C','Hotels':'#2B2444','Other':'#8A7F68'
};

function nearbySavedPlaces(pts){
  if(typeof MY_MAPS_PLACES === 'undefined' || !pts.length) return [];
  // "nearby" = within walking-ish distance of one of today's actual stops.
  // A bounding box breaks down on intercity days (Osaka->Tokyo would swallow
  // the whole country), so measure real distance to each stop instead.
  const RADIUS_KM = 1.1, MAX_DOTS = 90;
  const toRad = x => x*Math.PI/180;
  function distKm(aLat,aLon,bLat,bLon){
    const R=6371, dLat=toRad(bLat-aLat), dLon=toRad(bLon-aLon);
    const s = Math.sin(dLat/2)**2 + Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(s));
  }
  const routeKeys = new Set(pts.map(p=>`${p.lat.toFixed(4)},${p.lon.toFixed(4)}`));
  const out = [];
  for(const p of MY_MAPS_PLACES){
    if(routeKeys.has(`${p.lat.toFixed(4)},${p.lon.toFixed(4)}`)) continue;
    let best = Infinity;
    for(const s of pts){
      const dkm = distKm(p.lat,p.lon,s.lat,s.lon);
      if(dkm < best) best = dkm;
      if(best <= RADIUS_KM) break;
    }
    if(best <= RADIUS_KM) out.push({...p, _d:best});
  }
  out.sort((a,b)=>a._d-b._d);
  return out.slice(0, MAX_DOTS);
}

function renderDayMap(day){
  const wrap = document.getElementById('dayMapWrap');
  const pts = day.events.filter(e=>e.geo).map(e=>({...e.geo, activity:e.activity, type:typeGuess(e)}));
  if(window._dayMap){ window._dayMap.remove(); window._dayMap = null; }
  if(pts.length < 1){ wrap.style.display = 'none'; wrap.innerHTML=''; return; }
  wrap.style.display = 'block';

  const gurl = pts.length===1
    ? `https://www.google.com/maps/search/?api=1&query=${pts[0].lat},${pts[0].lon}`
    : `https://www.google.com/maps/dir/${pts.slice(0,10).map(p=>`${p.lat},${p.lon}`).join('/')}`;

  const saved = nearbySavedPlaces(pts);

  wrap.innerHTML = `
    <div id="dayMap"></div>
    <div class="daymap-legend">
      <span><i class="lg-line"></i>today's route</span>
      <span><i class="lg-num"></i>stops, in order</span>
      ${saved.length? `<span><i class="lg-dot"></i>${saved.length} saved places nearby</span>`:''}
    </div>
    <a class="daymap-link" href="${gurl}" target="_blank" rel="noopener">Open route in Google Maps ↗</a>
  `;

  const map = L.map('dayMap', {scrollWheelZoom:false, zoomControl:true, dragging:!L.Browser.mobile, attributionControl:false, tap:false});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom:19, subdomains:'abcd'
  }).addTo(map);

  // small pins: everything else saved in My Maps around today's area
  saved.forEach(p=>{
    const color = KML_CAT_COLOR[p.cat] || KML_CAT_COLOR.Other;
    L.circleMarker([p.lat,p.lon], {
      radius:3.5, color:'#fff', weight:1, fillColor:color, fillOpacity:.85
    }).addTo(map).bindPopup(`<b>${esc(p.name)}</b><br><span style="color:${color};font-weight:600;font-size:11px">${esc(p.cat)}</span>${p.desc?'<br>'+esc(p.desc):''}`);
  });

  // the day's own route on top
  if(pts.length >= 2){
    L.polyline(pts.map(p=>[p.lat,p.lon]), {color:'#3E5C76', weight:2.5, opacity:.75, dashArray:'1 6', lineCap:'round'}).addTo(map);
  }
  pts.forEach((p,i)=>{
    const color = DAY_TYPE_COLOR[p.type] || '#8A7F68';
    L.marker([p.lat,p.lon], {
      icon: L.divIcon({
        className:'',
        html:`<div class="daypin" style="background:${color}"><span>${i+1}</span></div>`,
        iconSize:[24,24], iconAnchor:[12,12]
      }),
      zIndexOffset: 500
    }).addTo(map).bindPopup(`<b>${i+1}. ${esc(p.activity)}</b>`);
  });

  const bounds = pts.map(p=>[p.lat,p.lon]);
  if(pts.length===1) map.setView(bounds[0], 15);
  else map.fitBounds(bounds, {padding:[26,26]});
  window._dayMap = map;
}

function renderToday(){
  renderDayChips();
  const day = DATA[currentDay];

  const cities = [...new Set(day.events.map(e=>e.city).filter(Boolean))];
  const cityLabel = cities.length ? cities.join(' \u2192 ') : day.city;
  const kanji = CITY_KANJI[day.city] || '';
  const w = WeatherEngine.getForDay(day.date, day.city);

  document.getElementById('dayHead').innerHTML = `
    <div class="head-row">
      <div class="num-block">
        <div class="lab">Day</div>
        <div class="num">${String(currentDay+1).padStart(2,'0')}</div>
      </div>
      <div class="info">
        <div class="dateline">${fmtDateLine(day.date)}</div>
        <p class="city">${esc(cityLabel)}${kanji?` <span class="kanji">${kanji}</span>`:''}</p>
        <p class="tagline">${dayTagline(day, currentDay)}</p>
      </div>
    </div>
    ${weatherDetailHTML(w, day.city)}
  `;
  renderDayMap(day);

  const tl = document.getElementById('timeline');
  if(!day.events.length){ tl.innerHTML = `<div class="empty">Nothing scheduled for this day yet.</div>`; return; }

  tl.innerHTML = day.events.map(ev=>{
    const type = typeGuess(ev);
    const meta0 = TYPE_META[type];
    const time = ev.from ? ev.from : '\u00B7';
    const timeDisplay = ev.estTime ? `<span class="est-mark">~</span>${esc(time)}` : esc(time);
    let meta = [];
    if(ev.to && ev.to !== ev.from) meta.push(`until <b>${esc(ev.to)}</b>`);
    if(ev.info) meta.push(esc(ev.info));
    if(ev.platform && !/^\(no reservations\)/i.test(ev.platform)) meta.push(`via <b>${esc(ev.platform)}</b>`);
    let actions = [];
    if(ev.gmap) actions.push(`<a class="chip" href="${esc(ev.gmap)}" target="_blank" rel="noopener">📍 Map</a>`);
    ev.links.forEach(l=>actions.push(`<a class="chip gold" href="${esc(l)}" target="_blank" rel="noopener">🔗 Link</a>`));
    let resvBadge = '';
    if(ev.resv==='Booked') resvBadge = `<span class="badge booked">Booked</span>`;
    else if(ev.resv || ev.platform) resvBadge = `<span class="badge pending">Needs attention</span>`;
    return `
    <div class="stop type-${type}">
      <div class="dot">${timeDisplay}</div>
      <div class="card">
        ${ev.city ? `<div class="cityline">◆ ${esc(ev.city)}</div>` : ''}
        <div class="tag ${type}">${ICONS[type]} ${meta0.label}</div>
        <p class="title">${esc(ev.activity)}${resvBadge}</p>
        ${ev.desc? `<div class="desc">${esc(ev.desc)}</div>`:''}
        ${meta.length? `<div class="meta">${meta.join(' · ')}</div>`:''}
        ${ev.tip? `<div class="tip"><b>Your note</b>${esc(ev.tip)}</div>`:''}
        <div class="actions">${actions.join('')}</div>
      </div>
    </div>`;
  }).join('');
}

/* ============ TRIP (FULL) VIEW ============ */
function renderHero(){
  const first = DATA[0], last = DATA[DATA.length-1];
  const flightText = (first.events[0] && first.events[0].activity) || '';
  const airlineMatch = flightText.match(/,\s*([A-Za-z ]+Airlines)/);
  document.getElementById('heroBlock').innerHTML = `
    <div class="hero-eyebrow">✦ Personal Travel Journal ✦</div>
    <h2>Japan<span class="script">Nineteen Days</span></h2>
    <div class="season">Autumn · K\u014dy\u014d Season</div>
    <div class="route">Israel \u2192 Tokyo · Hakone · Kyoto · Nara · Osaka · Tokyo</div>
    <div class="metastrip">
      <div><div class="l">Departure</div><div class="v">${fmtDateShort(first.date)}, 2026</div></div>
      <div><div class="l">Return</div><div class="v">${fmtDateShort(last.date)}, 2026</div></div>
      <div><div class="l">Airline</div><div class="v">${airlineMatch? esc(airlineMatch[1]) : 'Etihad Airways'}</div></div>
      <div><div class="l">Season</div><div class="v">Koyo \u7d05\u8449</div></div>
    </div>`;
}

function renderTrip(){
  renderHero();
  const wrap = document.getElementById('tripList');
  wrap.innerHTML = DATA.map((day,i)=>{
    const w = WeatherEngine.getForDay(day.date, day.city);
    const rows = day.events.map(ev=>`
      <div class="erow">
        <div class="t">${esc(ev.from||'')}${ev.estTime?'<span class=\"est\">~</span>':''}</div>
        <div class="a">${ev.city?`<span class="c">${esc(ev.city)}</span>`:''}${esc(ev.activity)}${ev.desc?`<span class="ed">${esc(ev.desc)}</span>`:''}</div>
      </div>`).join('');
    return `<details class="trip-day">
      <summary>
        <div class="l"><span class="dnum">Day ${i+1} — ${fmtDateShort(day.date)}</span><span class="city">${esc(day.city)} · ${esc(day.dow)}</span></div>
        <span class="wx">${w? w.icon+' '+w.max+'\u00B0':''}</span>
        <span class="chev">›</span>
      </summary>
      <div class="events">
        ${rows}
        <button type="button" class="open-day-btn" onclick="currentDay=${i};renderToday();showView('today');">Open Day ${i+1} in Today \u2192</button>
      </div>
    </details>`;
  }).join('');
}
window.showView = showView;

/* ============ MAP VIEW ============ */
/* The map tab embeds the real Google My Maps map as-is (its own colors, icons and tiles) — nothing rebuilt here. */

/* ============ TASKS VIEW ============ */
function buildTaskList(){
  const tasks = [];
  DATA.forEach((day,di)=>{
    day.events.forEach((ev,ei)=>{
      if(ev.resv || (ev.platform && !/^\(no reservations\)/i.test(ev.platform))){
        tasks.push({
          id:`t-${di}-${ei}`, activity:ev.activity, date:day.date, city:ev.city||day.city,
          platform:ev.platform, note:/^(Booked|pending)$/i.test(ev.resv)?'':ev.resv,
          bookedByDefault:/^booked$/i.test(ev.resv)
        });
      }
    });
  });
  return tasks;
}
const ALL_TASKS = buildTaskList();

function renderTasks(){
  const done = LS.get('jtrip_tasks_done', {});
  const pending=[], booked=[];
  ALL_TASKS.forEach(t=>{
    const isDone = done[t.id]!==undefined ? done[t.id] : t.bookedByDefault;
    (isDone?booked:pending).push({...t,isDone});
  });
  const row = (t)=>`
    <label class="task-row ${t.isDone?'done':''}">
      <input type="checkbox" ${t.isDone?'checked':''} onchange="toggleTask('${t.id}', this.checked)">
      <div class="body">
        <div class="a">${esc(t.activity)}</div>
        <div class="d">Day ${DATA.findIndex(d=>d.date===t.date)+1} · ${fmtDateShort(t.date)} · ${esc(t.city||'')}${t.platform?' · '+esc(t.platform):''}${t.note?' · '+esc(t.note):''}</div>
      </div>
    </label>`;
  let html = `<div class="task-group-title">Needs attention (${pending.length})</div>`;
  html += pending.length? pending.map(row).join('') : `<div class="empty">Everything's booked!</div>`;
  html += `<div class="task-group-title">Already booked (${booked.length})</div>`;
  html += booked.length? booked.map(row).join('') : `<div class="empty">Nothing here yet</div>`;
  html += renderCustomTasks();
  document.getElementById('taskList').innerHTML = html;
}
function toggleTask(id,val){ const done=LS.get('jtrip_tasks_done',{}); done[id]=val; LS.set('jtrip_tasks_done',done); renderTasks(); }
window.toggleTask = toggleTask;

function renderCustomTasks(){
  const custom = LS.get('jtrip_custom_tasks', []);
  let html = `<div class="task-group-title">General to-dos</div>`;
  html += custom.map((t,i)=>`
    <label class="task-row ${t.done?'done':''}">
      <input type="checkbox" ${t.done?'checked':''} onchange="toggleCustomTask(${i}, this.checked)">
      <div class="body"><div class="a">${esc(t.text)}</div></div>
      <button type="button" onclick="deleteCustomTask(${i})" style="background:none;border:none;color:var(--muted);font-size:16px;cursor:pointer">✕</button>
    </label>`).join('');
  html += `<div class="add-row"><input type="text" id="newTaskInput" placeholder="Add a to-do (e.g. buy a JR Pass)"><button class="btn small" onclick="addCustomTask()">Add</button></div>`;
  return html;
}
function addCustomTask(){
  const inp = document.getElementById('newTaskInput');
  if(!inp.value.trim()) return;
  const custom = LS.get('jtrip_custom_tasks', []);
  custom.push({text:inp.value.trim(), done:false});
  LS.set('jtrip_custom_tasks', custom);
  renderTasks();
}
function toggleCustomTask(i,val){ const c=LS.get('jtrip_custom_tasks',[]); c[i].done=val; LS.set('jtrip_custom_tasks',c); renderTasks(); }
function deleteCustomTask(i){ const c=LS.get('jtrip_custom_tasks',[]); c.splice(i,1); LS.set('jtrip_custom_tasks',c); renderTasks(); }
window.addCustomTask=addCustomTask; window.toggleCustomTask=toggleCustomTask; window.deleteCustomTask=deleteCustomTask;

/* ============ BUDGET VIEW ============ */
const CATS = ['Flights','Lodging','Food','Activities','Shopping','Transport','Other'];
function renderBudget(){
  const expenses = LS.get('jtrip_expenses', []);
  const byCurrency = {};
  const catTotals = {};
  expenses.forEach(e=>{
    byCurrency[e.currency] = (byCurrency[e.currency]||0)+e.amount;
    catTotals[e.cat] = catTotals[e.cat] || {};
    catTotals[e.cat][e.currency] = (catTotals[e.cat][e.currency]||0)+e.amount;
  });
  document.getElementById('budgetTotal').innerHTML = Object.keys(byCurrency).length
    ? Object.entries(byCurrency).map(([cur,sum])=>`<div><div class="lab">Total ${cur}</div><div class="num">${sum.toLocaleString()}</div></div>`).join('')
    : `<div><div class="lab">Total spent</div><div class="num">0</div></div>`;
  document.getElementById('budgetCats').innerHTML = CATS.map(c=>{
    const sums = catTotals[c];
    const txt = sums? Object.entries(sums).map(([cur,v])=>`${v.toLocaleString()} ${cur}`).join(' · ') : '—';
    return `<div class="budget-cat"><div class="n">${c}</div><div class="v">${txt}</div></div>`;
  }).join('');
  const list = document.getElementById('expenseList');
  if(!expenses.length){ list.innerHTML = `<div class="empty">No expenses logged yet</div>`; return; }
  list.innerHTML = expenses.slice().reverse().map((e,ridx)=>{
    const i = expenses.length-1-ridx;
    return `<div class="expense-row">
      <div><span class="cat">${esc(e.cat)}</span>${esc(e.desc||'Expense')}</div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="amt">${e.amount.toLocaleString()} ${e.currency}</span>
        <button class="del" onclick="deleteExpense(${i})">✕</button>
      </div>
    </div>`;
  }).join('');
}
function addExpense(){
  const desc = document.getElementById('expDesc').value.trim();
  const amount = parseFloat(document.getElementById('expAmount').value);
  const cat = document.getElementById('expCat').value;
  const currency = document.getElementById('expCurrency').value;
  if(!amount || amount<=0) return;
  const expenses = LS.get('jtrip_expenses', []);
  expenses.push({desc, amount, cat, currency});
  LS.set('jtrip_expenses', expenses);
  document.getElementById('expDesc').value=''; document.getElementById('expAmount').value='';
  renderBudget();
}
function deleteExpense(i){ const e=LS.get('jtrip_expenses',[]); e.splice(i,1); LS.set('jtrip_expenses',e); renderBudget(); }
window.addExpense=addExpense; window.deleteExpense=deleteExpense;

/* ============ INIT ============ */
document.getElementById('expCat').innerHTML = CATS.map(c=>`<option>${c}</option>`).join('');

function safe(fn, label){
  try{ fn(); }catch(e){ console.error('Init step failed:', label, e); }
}
safe(renderToday, 'renderToday');
safe(renderTrip, 'renderTrip');
safe(renderTasks, 'renderTasks');
safe(renderBudget, 'renderBudget');

WeatherEngine.init().then(()=>{
  safe(renderToday, 'renderToday(weather)');
  safe(renderTrip, 'renderTrip(weather)');
}).catch(()=>{});
