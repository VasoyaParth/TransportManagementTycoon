// Self-contained Leaflet map HTML for the WebView. Mirrors the web version's
// CartoDB light tiles, HQ/truck/city/station markers, and animated dashed
// routes. Communicates with React Native via window.ReactNativeWebView.
// Data (cities/HQ) is injected via __GAME_DATA__; live updates arrive through
// window.applyState(...) called from RN injectJavaScript.

export function buildLeafletHtml(initial) {
  const data = JSON.stringify(initial).replace(/</g, '\\u003c');
  return `<!doctype html><html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{margin:0;height:100%;width:100%;background:#EEF1F4;font-family:-apple-system,Roboto,sans-serif}
  .hq-marker{width:44px;height:48px;filter:drop-shadow(0 3px 5px rgba(0,0,0,.3))}
  .hq-marker svg{width:44px;height:48px}
  .hub-marker{width:30px;height:26px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.25))}
  .hub-marker svg{width:30px;height:26px}
  .truck3d{transition:transform .3s linear}
  .city-dot{width:8px;height:8px;border-radius:50%;background:#8792A0;border:1.5px solid #fff}
  .city-dot.big{width:12px;height:12px;background:#5C6470}
  .city-dot.disc{background:#2563EB}
  .city-dot.undisc{opacity:.4;background:#AEB7C2}
  .fuel-dot{width:7px;height:7px;border-radius:50%;background:#D97706;border:1px solid #fff}
  .fuel-dot.ev{background:#0E9F5B}
  .leaflet-popup-content{font-size:13px}
  .leaflet-popup-content b{color:#0B0F14}
  @keyframes dash{to{stroke-dashoffset:-1000}}
  .animated-route{animation:dash 30s linear infinite}
  @keyframes pulseDot{from{transform:scale(0.7);opacity:.45}to{transform:scale(1.3);opacity:.05}}
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var RN = window.ReactNativeWebView;
function post(o){ try{ RN && RN.postMessage(JSON.stringify(o)); }catch(e){} }

// Fallback: if Leaflet/tiles fail to load, tell RN to show the offline map.
if(typeof L === 'undefined'){ post({type:'offline'}); }
else { boot(); }

function shade(hex,pct){var h=(hex||'#3A5A8C').replace('#','');var n=parseInt(h,16);var f=pct<0?0:255,p=Math.abs(pct);
  var r=(n>>16)&255,g=(n>>8)&255,b=n&255;function t(v){return Math.round((f-v)*p+v);}
  return '#'+((1<<24)+(t(r)<<16)+(t(g)<<8)+t(b)).toString(16).slice(1);}
// Same pseudo-3D truck as the offline map: shadow + extruded body + cab +
// wheels, with a three-tone shade (roof lighter, side/body mid, shadow
// darker) and a slight skew on the top faces for an isometric 2.5D read.
function truck3d(color,accent,heading){
  var dark=shade(color,-0.28), roof=shade(color,0.18);
  return '<div class="truck3d" style="transform:rotate('+((heading||0)+180)+'deg);width:40px;height:48px">'
   +'<svg width="40" height="48" viewBox="0 0 40 48">'
   +'<ellipse cx="22" cy="42" rx="10" ry="3" fill="rgba(0,0,0,0.12)"/>'
   +'<rect x="9" y="5" width="24" height="30" rx="5" fill="'+dark+'"/>'
   +'<rect x="8" y="3" width="24" height="26" rx="5" fill="'+color+'" stroke="#fff" stroke-width="2"/>'
   +'<rect x="12" y="6" width="16" height="7" rx="2" fill="'+roof+'" transform="skewX(-6)"/>'
   +'<rect x="12" y="6" width="16" height="7" rx="2" fill="'+accent+'" opacity="0.55"/>'
   +'<rect x="10" y="29" width="20" height="14" rx="4" fill="'+color+'" stroke="#fff" stroke-width="2"/>'
   +'<rect x="13" y="32" width="14" height="7" rx="2" fill="#DCE7FA"/>'
   +'<rect x="4" y="13" width="4" height="9" rx="2" fill="#181B20"/><rect x="32" y="13" width="4" height="9" rx="2" fill="#181B20"/>'
   +'<rect x="4" y="29" width="4" height="8" rx="2" fill="#181B20"/><rect x="32" y="29" width="4" height="8" rx="2" fill="#181B20"/>'
   +'</svg></div>';
}
// Big HQ office tower (same visual language as the offline map: blue tower,
// windows, amber flag) — a real building icon, not a circle badge.
function hqSvg(){return '<svg viewBox="0 0 44 48">'
  +'<rect x="21" y="2" width="2" height="10" fill="#0B0F14"/>'
  +'<path d="M23 2 L33 5.5 L23 9 Z" fill="#D97706"/>'
  +'<path d="M30 44 L30 14 L38 9 L38 39 Z" fill="#1E4FB8"/>'
  +'<path d="M6 14 L30 14 L38 9 L14 9 Z" fill="#5B8DF0"/>'
  +'<rect x="6" y="14" width="24" height="30" fill="#2563EB"/>'
  +'<rect x="9" y="18" width="5" height="5" fill="#DCE7FA"/><rect x="16" y="18" width="5" height="5" fill="#DCE7FA"/><rect x="23" y="18" width="5" height="5" fill="#DCE7FA"/>'
  +'<rect x="9" y="26" width="5" height="5" fill="#DCE7FA"/><rect x="16" y="26" width="5" height="5" fill="#DCE7FA"/><rect x="23" y="26" width="5" height="5" fill="#DCE7FA"/>'
  +'<rect x="9" y="34" width="5" height="5" fill="#DCE7FA"/><rect x="16" y="34" width="5" height="5" fill="#DCE7FA"/><rect x="23" y="34" width="5" height="5" fill="#DCE7FA"/>'
  +'<rect x="14" y="40" width="8" height="4" fill="#DCE7FA"/>'
  +'</svg>';}
// Small garage building for purchased hubs.
function hubSvg(){return '<svg viewBox="0 0 30 26">'
  +'<path d="M25 24 L25 8 L29 5 L29 21 Z" fill="#464C56"/>'
  +'<path d="M3 8 L25 8 L29 5 L7 5 Z" fill="#767E8A"/>'
  +'<rect x="3" y="8" width="22" height="16" fill="#5C6470"/>'
  +'<rect x="7" y="13" width="14" height="11" rx="1" fill="#E7E9EE"/>'
  +'<rect x="7" y="16" width="14" height="1.4" fill="#B9BFC9"/><rect x="7" y="19.5" width="14" height="1.4" fill="#B9BFC9"/>'
  +'</svg>';}

function boot(){
  var DATA = ${data};
  var pickMode = false;
  // Whole playable region: Kenya/Ethiopia in the southwest, Israel/Saudi in
  // the west, Russia/Kazakhstan in the north, Indonesia/Philippines/Taiwan in
  // the east — the two horizons of the empire.
  var REGION=L.latLngBounds([-12.0,28.0],[72.0,150.0]);
  var map = L.map('map',{center:[DATA.hq.lat,DATA.hq.lng],zoom:6,zoomControl:false,
    attributionControl:false,minZoom:3,maxBounds:REGION,maxBoundsViscosity:0.7});
  // No on-screen zoom buttons — pinch-to-zoom keeps the map corners clean.
  var tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    {maxZoom:19,subdomains:'abcd'});
  var tileErrors = 0;
  tiles.on('tileerror', function(){ tileErrors++; if(tileErrors===1) post({type:'tileerror'}); });
  tiles.addTo(map);

  var hqMarker=null, truckMarkers={}, routeLines={}, cityLayer=L.layerGroup().addTo(map),
      stationLayer=L.layerGroup(), citiesOn=true, stationsOn=false;

  // (zf() below is hoisted — shared marker zoom factor for HQ/hubs/trucks.)

  // HQ — big building tower icon, anchored at its base, scaled with zoom.
  function plotHQ(){
    var k=zf();
    var icon=L.divIcon({className:'',
      html:'<div class="hq-marker" style="transform:scale('+k+');transform-origin:22px 44px">'+hqSvg()+'</div>',
      iconSize:[44,48],iconAnchor:[22,44]});
    if(hqMarker){ hqMarker.setIcon(icon); }
    else {
      hqMarker=L.marker([DATA.hq.lat,DATA.hq.lng],{icon:icon,zIndexOffset:1000}).addTo(map)
        .bindTooltip('<b>'+DATA.companyName+'</b><br><small>HQ — tap for details</small>',{direction:'top'});
      hqMarker.on('click',function(){ post({type:'hqTap'}); });
    }
  }
  plotHQ();

  // Purchased garages/hubs — distinct small garage buildings, live-updatable.
  var hubLayer=L.layerGroup().addTo(map), lastHubs=DATA.hubs||[];
  function plotHubs(hubs){
    lastHubs=hubs||lastHubs;
    hubLayer.clearLayers();
    var k=zf();
    (lastHubs||[]).forEach(function(h){
      if(h.hq) return;
      var hm=L.marker([h.lat,h.lng],{icon:L.divIcon({className:'',
        html:'<div class="hub-marker" style="transform:scale('+k+');transform-origin:15px 24px">'+hubSvg()+'</div>',
        iconSize:[30,26],iconAnchor:[15,24]}),zIndexOffset:900})
        .bindTooltip('<b>'+h.name+'</b><br><small>Garage — tap for details</small>',{direction:'top'});
      hm.on('click',function(){ post({type:'hubTap',cityId:h.cityId}); });
      hubLayer.addLayer(hm);
    });
  }
  plotHubs(DATA.hubs);
  window.setHubs=function(hubs){ plotHubs(hubs); };

  // Fixed sea ports (ferry endpoints) — anchor badges toggleable from the RN
  // control stack. Initial visibility comes from the persisted setting
  // (DATA.portsOn) so "off" survives app restarts; badges scale with zoom
  // exactly like truck markers (zf()).
  var portsOn=(DATA.portsOn!==false), portLayer=L.layerGroup().addTo(map);
  var anchorSvg='<svg viewBox="0 0 24 24" width="14" height="14"><path fill="#fff" d="M12,2A3,3 0 0,1 15,5C15,6.31 14.17,7.42 13,7.83V9H15V11H13V19.92C14.26,19.75 15.62,19.29 16.66,18.63C16.09,18.05 15.72,17.28 15.66,16.43L17.66,16.29C17.72,17.13 18.44,17.8 19.3,17.8C20.21,17.8 20.95,17.06 20.95,16.15H22.95C22.95,18.16 21.31,19.8 19.3,19.8L19.13,19.8C17.55,21.07 14.89,22 12,22C9.11,22 6.45,21.07 4.87,19.8L4.7,19.8C2.69,19.8 1.05,18.16 1.05,16.15H3.05C3.05,17.06 3.79,17.8 4.7,17.8C5.56,17.8 6.28,17.13 6.34,16.29L8.34,16.43C8.28,17.28 7.91,18.05 7.34,18.63C8.38,19.29 9.74,19.75 11,19.92V11H9V9H11V7.83C9.83,7.42 9,6.31 9,5A3,3 0 0,1 12,2M12,4A1,1 0 0,0 11,5A1,1 0 0,0 12,6A1,1 0 0,0 13,5A1,1 0 0,0 12,4Z"/></svg>';
  function plotPorts(){
    portLayer.clearLayers();
    if(!portsOn) return;
    var k=zf();
    (DATA.ports||[]).forEach(function(p){
      portLayer.addLayer(L.marker([p.lat,p.lng],{icon:L.divIcon({className:'',
        html:'<div style="transform:scale('+k+');transform-origin:11px 11px;width:22px;height:22px;border-radius:50%;background:#0E4C7A;border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,.3)">'+anchorSvg+'</div>',
        iconSize:[22,22],iconAnchor:[11,11]}),zIndexOffset:800})
        .bindTooltip('<b>'+p.name+'</b><br><small>Sea port — ferry crossing</small>',{direction:'top'}));
    });
  }
  plotPorts();
  map.on('zoomend',function(){ if(portsOn) plotPorts(); });
  window.togglePorts=function(){ portsOn=!portsOn; plotPorts(); };
  // Explicit on/off from RN (persisted in settings.showPorts).
  window.setPorts=function(on){ portsOn=!!on; plotPorts(); };

  // Cities — only unlocked countries; discovered cities (routes driven,
  // garages, HQ) render highlighted, the rest as faint "unexplored" dots that
  // only appear once zoomed in (big perf win: hundreds fewer markers).
  var allowedCountries = null, discovered = {};
  function plotCities(){
    cityLayer.clearLayers();
    var z = map.getZoom();
    DATA.cities.forEach(function(c){
      if(allowedCountries && allowedCountries.indexOf(c.country||'IN')<0) return;
      var disc = !!discovered[c.id];
      // While picking a destination every city must be tappable — show all
      // dots; otherwise unexplored ones only fade in as you zoom.
      if(!disc && !pickMode && !(c.tier===1 && z>=5 || c.tier===2 && z>=7 || z>=9)) return;
      var big = c.tier===1;
      var cls = 'city-dot'+(big?' big':'')+(disc?' disc':' undisc');
      var m=L.marker([c.lat,c.lng],{icon:L.divIcon({className:'',
        html:'<div class="'+cls+'"></div>',iconSize:[big?12:8,big?12:8],iconAnchor:[big?6:4,big?6:4]}),
        zIndexOffset:disc?150:100}).bindTooltip('<b>'+c.name+'</b><br><small>'+c.state+'</small>',{direction:'top'});
      m.on('click',function(){ if(pickMode){ post({type:'pickCity',id:c.id}); } else { m.openTooltip(); } });
      cityLayer.addLayer(m);
    });
  }
  plotCities();
  map.on('zoomend', function(){
    plotCities(); plotHQ(); plotHubs();
    lastTrucks.forEach(setTruck); // re-render at the new zoom scale factor
  });
  window.setVisibleCountries=function(arr){ allowedCountries = arr && arr.length ? arr : null; plotCities(); };
  window.setDiscovered=function(ids){ discovered={}; (ids||[]).forEach(function(id){ discovered[id]=1; }); plotCities(); };

  function renderStations(){
    stationLayer.clearLayers();
    if(map.getZoom()<8) return;
    var b=map.getBounds();
    (DATA.stations||[]).forEach(function(s){
      if(!b.contains([s.lat,s.lng])) return;
      var m=L.marker([s.lat,s.lng],{icon:L.divIcon({className:'',
        html:'<div class="fuel-dot'+(s.type==='ev'?' ev':'')+'"></div>',iconSize:[8,8],iconAnchor:[4,4]})})
        .bindPopup('<b>'+s.name+'</b><br>'+(s.type==='ev'?'EV · ₹'+s.price+'/kWh':'Diesel · ₹'+s.price+'/L'));
      stationLayer.addLayer(m);
    });
  }
  map.on('zoomend moveend',function(){ if(stationsOn) renderStations(); });

  // Marker zoom factor: markers shrink as you zoom out and grow (capped) as
  // you zoom in, instead of a fixed 40px that dwarfs the whole country view.
  function zf(){ var z=map.getZoom(); return Math.max(0.35, Math.min(1.25, (z-3)/4)); }
  var lastTrucks=[];
  function setTruck(t){
    var accent = t.status==='delivering'?'#0E9F5B':t.status==='building'?'#D97706':t.status==='broken'?'#DC3D43':'#9DB2D6';
    var color = t.color || '#3A5A8C';
    var html, w=40, h=48, anchorY=24;
    if((t.ferryOn || t.ferryLoading) && t.ferryArt){
      // On (or boarding/leaving) the ferry: always the big RO-RO steamer with
      // the truck on deck — never a truck on water, never a blurred truck.
      // While docked (paperwork + roll-on/off) a pulsing ring marks the port.
      w=48; h=72; anchorY=36;
      html='<div class="truck3d" style="transform:rotate('+((t.heading||0)+180)+'deg);width:'+w+'px;height:'+h+'px;transform-origin:'+(w/2)+'px '+anchorY+'px">'
        +t.ferryArt+'</div>';
      if(t.ferryLoading){
        html='<div style="position:relative">'+html
          +'<div style="position:absolute;left:50%;top:50%;width:30px;height:30px;margin:-15px;border-radius:50%;background:rgba(37,99,235,.45);animation:pulseDot 1s ease-in-out infinite alternate"></div></div>';
      }
    } else if(t.art){
      // Detailed per-model artwork pre-rendered on the RN side (truckArt.js).
      w=t.artW||40; h=t.artH||48; anchorY=(t.bodyH||h)/2;
      html='<div class="truck3d" style="transform:rotate('+((t.heading||0)+180)+'deg);width:'+w+'px;height:'+h+'px;transform-origin:'+(w/2)+'px '+anchorY+'px">'
        +t.art+'</div>';
      if(t.phase==='loading'||t.phase==='unloading'){
        html='<div style="position:relative">'+html
          +'<div style="position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px;border-radius:50%;background:rgba(217,119,6,.4);animation:pulseDot 1s ease-in-out infinite alternate"></div></div>';
      }
    } else {
      html=truck3d(color,accent,t.heading);
    }
    if(t.incidentType){
      // Incident badge — every scenario gets its own colour + glyph so the
      // player can read the problem at a glance: accident !, tyre burst !,
      // theft/checkpost ₹ (money hit), heavy weather/rain/snow ☂.
      var badgeColor = {accident:'#DC3D43',flat:'#D97706',theft:'#7D3C98',checkpost:'#2563EB',weather:'#0E7C86'}[t.incidentType]||'#DC3D43';
      var badgeGlyph = {accident:'!',flat:'!',theft:'\\u20B9',checkpost:'\\u20B9',weather:'\\u2602'}[t.incidentType]||'!';
      html='<div style="position:relative">'+html
        +'<div style="position:absolute;right:2px;top:0;width:16px;height:16px;border-radius:50%;'
        +'background:'+badgeColor+';border:1.5px solid #fff;color:#fff;font-size:10px;font-weight:700;'
        +'line-height:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.4)">'+badgeGlyph+'</div>'
        +'<div style="position:absolute;right:-2px;top:-4px;width:24px;height:24px;border-radius:50%;'
        +'background:'+badgeColor+';opacity:.35;animation:pulseDot 1s ease-in-out infinite alternate"></div></div>';
    }
    html='<div style="transform:scale('+zf()+');transform-origin:'+(w/2)+'px '+anchorY+'px">'+html+'</div>';
    var icon=L.divIcon({className:'',html:html,iconSize:[w,h],iconAnchor:[w/2,anchorY]});
    if(truckMarkers[t.id]){ truckMarkers[t.id].setIcon(icon); truckMarkers[t.id].setLatLng([t.lat,t.lng]); }
    else{
      var m=L.marker([t.lat,t.lng],{icon:icon,zIndexOffset:500}).addTo(map)
        .bindPopup('<b>'+t.name+'</b><br>'+t.statusLabel+'<br>Fuel '+t.fuelPct+'%');
      m.on('click',function(){ post({type:'truckTap',id:t.id}); });
      truckMarkers[t.id]=m;
    }
  }
  function setRoute(r){
    if(routeLines[r.id]) routeLines[r.id].forEach(function(l){map.removeLayer(l);});
    var coords=r.points.map(function(p){return [p.lat,p.lng];});
    var shadow=L.polyline(coords,{color:'rgba(0,0,0,.25)',weight:6,opacity:.4}).addTo(map);
    var line=L.polyline(coords,{color:'#2563EB',weight:3,opacity:.9,dashArray:'10 6',className:'animated-route'}).addTo(map);
    var arr=[shadow,line];
    // Sea legs re-drawn on top as ship lanes (teal, wave-dashed) between the
    // two dock anchors — makes every ferry crossing read as sea, not road.
    (r.seaLegs||[]).forEach(function(leg){
      var sc=leg.map(function(p){return [p.lat,p.lng];});
      arr.push(L.polyline(sc,{color:'#0E4C7A',weight:4,opacity:.9,dashArray:'2 8',lineCap:'round'}).addTo(map)
        .bindTooltip('Sea route — truck crosses aboard the ferry',{sticky:true}));
    });
    // Highlight fuel/charge stops along the active road.
    (r.stops||[]).forEach(function(st){
      arr.push(L.circleMarker([st.lat,st.lng],{radius:5,color:'#fff',weight:2,
        fillColor:(st.station&&st.station.type==='ev')?'#0E9F5B':'#D97706',fillOpacity:1}).addTo(map)
        .bindPopup(st.station?('<b>'+st.station.name+'</b>'):'Fuel stop'));
    });
    routeLines[r.id]=arr;
  }
  var corridorLines={};
  function setCorridor(c){
    if(corridorLines[c.id]) return; // static once drawn
    var coords=c.points.map(function(p){return [p.lat,p.lng];});
    corridorLines[c.id]=L.polyline(coords,{color:'#2563EB',weight:3,opacity:.22}).addTo(map);
  }

  // Apply live state pushed from RN
  window.applyState=function(s){
    var live={};
    lastTrucks=s.trucks||[];
    (s.trucks||[]).forEach(function(t){ live[t.id]=1; setTruck(t); });
    Object.keys(truckMarkers).forEach(function(id){ if(!live[id]){ map.removeLayer(truckMarkers[id]); delete truckMarkers[id]; }});
    var liveR={};
    (s.routes||[]).forEach(function(r){ liveR[r.id]=1; setRoute(r); });
    Object.keys(routeLines).forEach(function(id){ if(!liveR[id]){ routeLines[id].forEach(function(l){map.removeLayer(l);}); delete routeLines[id]; }});
    // Discovered corridors stay highlighted.
    var liveC={};
    (s.corridors||[]).forEach(function(c){ liveC[c.id]=1; setCorridor(c); });
    Object.keys(corridorLines).forEach(function(id){ if(!liveC[id]){ map.removeLayer(corridorLines[id]); delete corridorLines[id]; }});
  };
  // Regional weather overlays (v2.4.0) — drawn ONLY where a zone is active
  // today: translucent circle in the kind's colour + a small SVG badge.
  // Compact hand-drawn glyphs (no fonts/emoji): rain drops, snowflake,
  // wind lines, lightning bolt, fog bars.
  var weatherLayer=L.layerGroup().addTo(map);
  function wxGlyph(kind){
    if(kind==='snow') return '<path d="M7 1 L7 13 M1 7 L13 7 M2.8 2.8 L11.2 11.2 M11.2 2.8 L2.8 11.2" stroke="#fff" stroke-width="1.6" fill="none"/>';
    if(kind==='dust') return '<path d="M1 4 H10 M1 7 H13 M1 10 H8" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
    if(kind==='storm') return '<path d="M8 1 L3 8 H6.5 L5 13 L11 5.5 H7.5 L9.5 1 Z" fill="#fff"/>';
    if(kind==='fog') return '<path d="M2 4 H12 M1 7 H13 M2 10 H12" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-dasharray="3 2"/>';
    // rain / heavyrain — slanted drops
    return '<path d="M4 2 L2.5 6 M8 2 L6.5 6 M12 2 L10.5 6 M5.5 8 L4 12 M9.5 8 L8 12" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
  }
  window.setWeather=function(zones){
    weatherLayer.clearLayers();
    (zones||[]).forEach(function(z){
      // Irregular organic outline (like a state boundary), not a circle —
      // exactly the boundary that slows trucks inside it.
      if(z.outline && z.outline.length>2){
        weatherLayer.addLayer(L.polygon(z.outline,{color:z.color,weight:1.5,opacity:0.6,
          fillColor:z.color,fillOpacity:0.14,dashArray:'6 5',smoothFactor:1.2}));
      } else if(z.radiusKm){
        weatherLayer.addLayer(L.circle([z.lat,z.lng],{radius:z.radiusKm*1000,color:z.color,weight:1.5,
          opacity:0.55,fillColor:z.color,fillOpacity:0.13,dashArray:'6 5'}));
      }
      weatherLayer.addLayer(L.marker([z.lat,z.lng],{icon:L.divIcon({className:'',
        html:'<div style="width:26px;height:26px;border-radius:50%;background:'+z.color+';border:2px solid #fff;'
          +'display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,.3)">'
          +'<svg viewBox="0 0 14 14" width="14" height="14">'+wxGlyph(z.kind)+'</svg></div>',
        iconSize:[26,26],iconAnchor:[13,13]}),zIndexOffset:700})
        .bindTooltip('<b>'+z.label+'</b><br><small>Trucks '+z.slowPct+'% slower in this zone</small>',{direction:'top'}));
    });
  };

  window.setPickMode=function(on){ pickMode=on; map.getContainer().style.cursor=on?'crosshair':''; plotCities(); };
  window.focusOn=function(lat,lng,z){ map.flyTo([lat,lng],z||9,{duration:1.0}); };
  window.centerHQ=function(){ map.flyTo([DATA.hq.lat,DATA.hq.lng],7,{duration:1.0}); };
  window.toggleCities=function(){ citiesOn=!citiesOn; if(citiesOn) cityLayer.addTo(map); else map.removeLayer(cityLayer); };
  window.toggleStations=function(){ stationsOn=!stationsOn; if(stationsOn){ stationLayer.addTo(map); renderStations(); } else map.removeLayer(stationLayer); };

  map.whenReady(function(){ post({type:'ready'}); });
  if(DATA.initialState) window.applyState(DATA.initialState);
}
</script>
</body></html>`;
}
