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
  .hq-marker{width:40px;height:40px;border-radius:50%;background:#2563EB;border:3px solid #fff;
    display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,.3)}
  .hq-marker svg{width:22px;height:22px;fill:#fff}
  .truck3d{transition:transform .3s linear}
  .city-dot{width:8px;height:8px;border-radius:50%;background:#8792A0;border:1.5px solid #fff}
  .city-dot.big{width:12px;height:12px;background:#5C6470}
  .fuel-dot{width:7px;height:7px;border-radius:50%;background:#D97706;border:1px solid #fff}
  .fuel-dot.ev{background:#0E9F5B}
  .leaflet-popup-content{font-size:13px}
  .leaflet-popup-content b{color:#0B0F14}
  @keyframes dash{to{stroke-dashoffset:-1000}}
  .animated-route{animation:dash 30s linear infinite}
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
// Same pseudo-3D truck as the offline map: shadow + extruded body + cab + wheels.
function truck3d(color,accent,heading){
  var dark=shade(color,-0.28);
  return '<div style="transform:perspective(150px) rotateX(34deg)">'
   +'<div class="truck3d" style="transform:rotate('+((heading||0)+180)+'deg);width:40px;height:48px">'
   +'<svg width="40" height="48" viewBox="0 0 40 48">'
   +'<ellipse cx="22" cy="42" rx="13" ry="5" fill="rgba(0,0,0,0.22)"/>'
   +'<rect x="9" y="5" width="24" height="30" rx="5" fill="'+dark+'"/>'
   +'<rect x="8" y="3" width="24" height="26" rx="5" fill="'+color+'" stroke="#fff" stroke-width="2"/>'
   +'<rect x="12" y="6" width="16" height="7" rx="2" fill="'+accent+'"/>'
   +'<rect x="10" y="29" width="20" height="14" rx="4" fill="'+color+'" stroke="#fff" stroke-width="2"/>'
   +'<rect x="13" y="32" width="14" height="7" rx="2" fill="#DCE7FA"/>'
   +'<rect x="4" y="13" width="4" height="9" rx="2" fill="#181B20"/><rect x="32" y="13" width="4" height="9" rx="2" fill="#181B20"/>'
   +'<rect x="4" y="29" width="4" height="8" rx="2" fill="#181B20"/><rect x="32" y="29" width="4" height="8" rx="2" fill="#181B20"/>'
   +'</svg></div></div>';
}
function bldgSvg(){return '<svg viewBox="0 0 24 24"><path d="M4 21V9l8-6 8 6v12h-5v-6h-6v6H4z"/></svg>';}

function boot(){
  var DATA = ${data};
  var pickMode = false;
  var INDIA=L.latLngBounds([6.0,67.5],[37.6,98.0]);
  var map = L.map('map',{center:[DATA.hq.lat,DATA.hq.lng],zoom:6,zoomControl:false,
    attributionControl:false,minZoom:4,maxBounds:INDIA,maxBoundsViscosity:1.0});
  // No on-screen zoom buttons — pinch-to-zoom keeps the map corners clean.
  var tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    {maxZoom:19,subdomains:'abcd'});
  var tileErrors = 0;
  tiles.on('tileerror', function(){ tileErrors++; if(tileErrors===1) post({type:'tileerror'}); });
  tiles.addTo(map);

  var hqMarker=null, truckMarkers={}, routeLines={}, cityLayer=L.layerGroup().addTo(map),
      stationLayer=L.layerGroup(), citiesOn=true, stationsOn=false;

  // HQ
  hqMarker = L.marker([DATA.hq.lat,DATA.hq.lng],{icon:L.divIcon({className:'',
    html:'<div class="hq-marker">'+bldgSvg()+'</div>',iconSize:[40,40],iconAnchor:[20,20]}),zIndexOffset:1000})
    .addTo(map).bindPopup('<b>'+DATA.companyName+'</b><br>HQ — '+DATA.hq.name);

  // Cities — only show dots for unlocked countries (null = show all).
  var allowedCountries = null;
  function plotCities(){
    cityLayer.clearLayers();
    DATA.cities.forEach(function(c){
      if(allowedCountries && allowedCountries.indexOf(c.country||'IN')<0) return;
      var big = c.tier===1;
      var m=L.marker([c.lat,c.lng],{icon:L.divIcon({className:'',
        html:'<div class="city-dot'+(big?' big':'')+'"></div>',iconSize:[big?12:8,big?12:8],iconAnchor:[big?6:4,big?6:4]}),
        zIndexOffset:100}).bindTooltip('<b>'+c.name+'</b><br><small>'+c.state+'</small>',{direction:'top'});
      m.on('click',function(){ if(pickMode){ post({type:'pickCity',id:c.id}); } else { m.openTooltip(); } });
      cityLayer.addLayer(m);
    });
  }
  plotCities();
  window.setVisibleCountries=function(arr){ allowedCountries = arr && arr.length ? arr : null; plotCities(); };

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
    var html, w=40, h=48;
    if(t.art){
      // Detailed per-model artwork pre-rendered on the RN side (truckArt.js).
      w=t.artW||40; h=t.artH||48;
      html='<div style="transform:perspective(170px) rotateX(30deg)">'
        +'<div class="truck3d" style="transform:rotate('+((t.heading||0)+180)+'deg);width:'+w+'px;height:'+h+'px">'
        +t.art+'</div></div>';
    } else {
      html=truck3d(color,accent,t.heading);
    }
    var icon=L.divIcon({className:'',html:html,iconSize:[w,h],iconAnchor:[w/2,h/2]});
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
  window.setPickMode=function(on){ pickMode=on; map.getContainer().style.cursor=on?'crosshair':''; };
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
