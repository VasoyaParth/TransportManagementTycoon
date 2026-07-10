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
  // Whole playable region (India + every unlockable country: Afghanistan to
  // Malaysia/China) — the camera is free to roam anywhere the empire can go.
  var REGION=L.latLngBounds([-9.0,55.0],[46.0,125.0]);
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

  // HQ — big building tower icon, anchored at its base.
  hqMarker = L.marker([DATA.hq.lat,DATA.hq.lng],{icon:L.divIcon({className:'',
    html:'<div class="hq-marker">'+hqSvg()+'</div>',iconSize:[44,48],iconAnchor:[22,44]}),zIndexOffset:1000})
    .addTo(map).bindPopup('<b>'+DATA.companyName+'</b><br>HQ — '+DATA.hq.name);

  // Purchased garages/hubs — distinct small garage buildings, live-updatable.
  var hubLayer=L.layerGroup().addTo(map);
  function plotHubs(hubs){
    hubLayer.clearLayers();
    (hubs||[]).forEach(function(h){
      if(h.hq) return;
      hubLayer.addLayer(L.marker([h.lat,h.lng],{icon:L.divIcon({className:'',
        html:'<div class="hub-marker">'+hubSvg()+'</div>',iconSize:[30,26],iconAnchor:[15,24]}),zIndexOffset:900})
        .bindPopup('<b>'+h.name+'</b><br>Garage — free refuel & fast-travel'));
    });
  }
  plotHubs(DATA.hubs);
  window.setHubs=function(hubs){ plotHubs(hubs); };

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
  map.on('zoomend', plotCities);
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

  function setTruck(t){
    var accent = t.status==='delivering'?'#0E9F5B':t.status==='building'?'#D97706':t.status==='broken'?'#DC3D43':'#9DB2D6';
    var color = t.color || '#3A5A8C';
    var html, w=40, h=48, anchorY=24;
    if(t.ferryOn && !t.ferryLoading && t.ferryArt){
      // Crossing the sea hop — swap the truck art for a ferry icon.
      // No perspective wrapper: it distorted the art (wide rear / pinched
      // front, changing with heading). Clean flat top-down rotation only.
      w=40; h=36; anchorY=18;
      html='<div class="truck3d" style="transform:rotate('+((t.heading||0)+180)+'deg);width:'+w+'px;height:'+h+'px;transform-origin:'+(w/2)+'px '+anchorY+'px">'
        +t.ferryArt+'</div>';
    } else if(t.art){
      // Detailed per-model artwork pre-rendered on the RN side (truckArt.js).
      w=t.artW||40; h=t.artH||48; anchorY=(t.bodyH||h)/2;
      var loadStyle = t.ferryLoading ? 'opacity:.55;' : '';
      html='<div class="truck3d" style="'+loadStyle+'transform:rotate('+((t.heading||0)+180)+'deg)'+(t.ferryLoading?' scale(0.8)':'')+';width:'+w+'px;height:'+h+'px;transform-origin:'+(w/2)+'px '+anchorY+'px">'
        +t.art+'</div>';
      if(t.ferryLoading){
        html='<div style="position:relative">'+html
          +'<div style="position:absolute;left:50%;top:50%;width:24px;height:24px;margin:-12px;border-radius:50%;background:rgba(37,99,235,.5);animation:pulseDot 1s ease-in-out infinite alternate"></div></div>';
      }
    } else {
      html=truck3d(color,accent,t.heading);
    }
    if(t.incidentType){
      // Damage/theft badge — small colored dot, offset to the corner.
      var badgeColor = t.incidentType==='accident' ? '#DC3D43' : '#7D3C98';
      html='<div style="position:relative">'+html
        +'<div style="position:absolute;right:2px;top:0;width:15px;height:15px;border-radius:50%;'
        +'background:'+badgeColor+';border:1.5px solid #fff;color:#fff;font-size:10px;font-weight:700;'
        +'line-height:15px;text-align:center">'+(t.incidentType==='accident'?'!':'$')+'</div></div>';
    }
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
