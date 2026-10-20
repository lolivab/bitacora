/* Plan de ruta (NavLog) — etapas 1 y 2. Solo visible para el administrador mientras se prueba. */
(function(){
'use strict';
const RAD=Math.PI/180,DEG=180/Math.PI;

/* ---------- cálculo (funciones puras) ---------- */
function distNM(a,b){const dl=(b[0]-a[0])*RAD,dn=(b[1]-a[1])*RAD,h=Math.sin(dl/2)**2+Math.cos(a[0]*RAD)*Math.cos(b[0]*RAD)*Math.sin(dn/2)**2;return 2*3440.065*Math.asin(Math.min(1,Math.sqrt(h)))}
function bearing(a,b){const f1=a[0]*RAD,f2=b[0]*RAD,dn=(b[1]-a[1])*RAD,y=Math.sin(dn)*Math.cos(f2),x=Math.cos(f1)*Math.sin(f2)-Math.sin(f1)*Math.cos(f2)*Math.cos(dn);return(Math.atan2(y,x)*DEG+360)%360}
function midpoint(a,b){const f1=a[0]*RAD,l1=a[1]*RAD,f2=b[0]*RAD,dl=(b[1]-a[1])*RAD,bx=Math.cos(f2)*Math.cos(dl),by=Math.cos(f2)*Math.sin(dl),f3=Math.atan2(Math.sin(f1)+Math.sin(f2),Math.sqrt((Math.cos(f1)+bx)**2+by*by)),l3=l1+Math.atan2(by,Math.cos(f1)+bx);return[f3*DEG,((l3*DEG+540)%360)-180]}
function gcPts(a,b,n){const v=p=>[Math.cos(p[0]*RAD)*Math.cos(p[1]*RAD),Math.cos(p[0]*RAD)*Math.sin(p[1]*RAD),Math.sin(p[0]*RAD)],A=v(a),B=v(b),w=Math.acos(Math.min(1,Math.max(-1,A[0]*B[0]+A[1]*B[1]+A[2]*B[2]))),o=[];let prev=null;for(let i=0;i<=n;i++){const f=i/n,k1=w?Math.sin((1-f)*w)/Math.sin(w):1-f,k2=w?Math.sin(f*w)/Math.sin(w):f,x=k1*A[0]+k2*B[0],y=k1*A[1]+k2*B[1],z=k1*A[2]+k2*B[2];let lon=Math.atan2(y,x)*DEG;if(prev!==null)while(lon-prev>180)lon-=360;while(prev!==null&&lon-prev<-180)lon+=360;prev=lon;o.push([Math.atan2(z,Math.hypot(x,y))*DEG,lon])}return o}
let GRID=null;
function decl(lat,lon){if(!GRID)return 0;const la=Math.max(-90,Math.min(90,lat)),lo=((lon+540)%360)-180,fy=(la+90)/2,fx=(lo+180)/2,y0=Math.min(89,Math.floor(fy)),x0=Math.min(179,Math.floor(fx)),ty=fy-y0,tx=fx-x0,g=(y,x)=>GRID[y][x];return((g(y0,x0)*(1-tx)+g(y0,x0+1)*tx)*(1-ty)+(g(y0+1,x0)*(1-tx)+g(y0+1,x0+1)*tx)*ty)/10}
const hhmm=min=>{const m=Math.round(min),h=Math.floor(m/60);return h+':'+String(m%60).padStart(2,'0')};
const hdg=d=>String(Math.round(d)%360===0?360:Math.round(d)%360).padStart(3,'0');
/* pts: [{c,lat,lon}], vav en kt. Devuelve tramos con rumbo magnético (medio del tramo), distancia y tiempos. */
function calcRuta(pts,vav){let acc=0,accD=0;const legs=[];for(let i=0;i<pts.length-1;i++){const a=[pts[i].lat,pts[i].lon],b=[pts[i+1].lat,pts[i+1].lon],d=distNM(a,b),m=midpoint(a,b),tc=bearing(m,b),v=decl(m[0],m[1]),mh=(tc-v+720)%360,t=vav>0?d/vav*60:0;acc+=t;accD+=d;legs.push({de:pts[i].c,a:pts[i+1].c,tc,v,mh,d,t,acc,accD})}return legs}
if(typeof module!=='undefined')module.exports={distNM,bearing,midpoint,decl,calcRuta,hhmm,hdg,_setGrid:g=>{GRID=g}};
if(typeof document==='undefined')return;

/* ---------- interfaz ---------- */
const $=id=>document.getElementById(id);
const E=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let built=false,map=null,layer=null,wps=['',''],editId=null,saved=[],lastLegs=null,lastPts=null;
const OTRO='__otro__';

function build(){
 const s=$('s-ruta');if(!s||built)return;built=true;
 s.innerHTML=`<style>
 #s-ruta .rt-wp{display:flex;gap:6px;align-items:center;margin-bottom:6px}
 #s-ruta .rt-wp input{flex:1;text-transform:uppercase;min-width:0}
 #s-ruta .rt-wp .rt-n{width:22px;text-align:center;font-weight:600;color:var(--muted,#667)}
 #s-ruta .rt-mini{padding:4px 8px;min-width:32px}
 #s-ruta table.rt td,#s-ruta table.rt th{white-space:nowrap}
 #s-ruta .rt-saved{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--line,#ddd)}
 </style>
 <div class="card" style="max-width:900px">
  <h2>Plan de ruta <span class="hint" style="font-weight:400">· NavLog (en pruebas, solo administrador)</span></h2>
  <p class="hint">Ingresa salida, destino y puntos intermedios (por ahora, aeródromos con código ICAO). Rumbos magnéticos con modelo WMM2025. Es una ayuda de planificación: no reemplaza el briefing ni la información oficial vigente (AIP, NOTAM).</p>
  <div id="rtWps"></div>
  <p><button class="btn ghost small" id="rtAdd" type="button">+ Punto intermedio</button></p>
  <datalist id="rtDl"></datalist>
  <div class="form">
   <div class="field"><label for="rtAv">Avión</label><select id="rtAv"></select></div>
   <div class="field"><label for="rtV">VAV (kt) — editable</label><input id="rtV" type="number" min="30" max="600" step="1" inputmode="numeric"></div>
   <div class="field"><label for="rtAlt">Altitud (ft)</label><input id="rtAlt" type="number" min="0" max="60000" step="500" value="5500" inputmode="numeric"></div>
  </div>
  <div class="field" id="rtOtroBox" style="display:none"><label for="rtOtroN">Nombre del avión (opcional)</label><input id="rtOtroN" maxlength="20" placeholder="Ej. C-150"></div>
  <p><button class="btn" id="rtGo" type="button">Calcular ruta</button></p>
  <div id="rtMsg"></div>
  <div id="rtMap" style="display:none;height:380px;border:1px solid var(--line,#ddd);border-radius:8px;margin:10px 0"></div>
  <div id="rtOut" style="overflow-x:auto"></div>
  <div id="rtSave" style="display:none">
   <hr style="border:0;border-top:1px solid var(--line,#ddd);margin:14px 0">
   <div class="form"><div class="field"><label for="rtNom">Nombre de la ruta</label><input id="rtNom" maxlength="80" placeholder="Ej. SCTB – SCVM ida"></div></div>
   <p><button class="btn" id="rtSv" type="button">Guardar ruta</button> <button class="btn ghost" id="rtCp" type="button">Copiar resumen</button> <button class="btn ghost" id="rtNew" type="button">Nueva ruta</button></p>
  </div>
  <h3 style="margin-top:18px">Mis rutas guardadas</h3>
  <div id="rtList" class="hint">Cargando…</div>
 </div>`;
 const sel=$('rtAv');
 sel.innerHTML=(typeof FLOTA!=='undefined'?FLOTA:[]).map((f,i)=>`<option value="${i}">${E(f[0])}</option>`).join('')+`<option value="${OTRO}">Otro avión…</option>`;
 const setV=()=>{const v=sel.value;$('rtOtroBox').style.display=v===OTRO?'':'none';if(v!==OTRO&&typeof FLOTA!=='undefined')$('rtV').value=FLOTA[+v][2]};
 sel.onchange=setV;setV();
 $('rtAdd').onclick=()=>{readWps();if(wps.length>=20)return;wps.splice(wps.length-1,0,'');drawWps()};
 $('rtGo').onclick=calcular;$('rtSv').onclick=guardar;$('rtCp').onclick=copiar;
 $('rtNew').onclick=()=>{editId=null;wps=['',''];$('rtNom').value='';$('rtOut').innerHTML='';$('rtSave').style.display='none';$('rtMap').style.display='none';msg('');drawWps();drawList()};
 drawWps();
}
function msg(t,k){const m=$('rtMsg');if(m)m.innerHTML=t?`<div class="msg ${k||''}">${E(t)}</div>`:''}
function readWps(){const r=[...document.querySelectorAll('#rtWps input')].map(i=>i.value.trim().toUpperCase());if(r.length)wps=r}
function drawWps(){
 const last=wps.length-1;
 $('rtWps').innerHTML=wps.map((c,i)=>{const lab=i===0?'Salida':i===last?'Destino':'Punto '+i;return`<div class="rt-wp"><span class="rt-n">${i+1}</span><input list="rtDl" maxlength="4" placeholder="${lab} (ICAO)" value="${E(c)}" aria-label="${lab}" data-i="${i}" autocomplete="off">`+
 (i>0&&i<last?`<button class="btn ghost small rt-mini" type="button" data-up="${i}" title="Subir">↑</button><button class="btn ghost small rt-mini" type="button" data-dn="${i}" title="Bajar">↓</button><button class="btn ghost small rt-mini" type="button" data-rm="${i}" title="Quitar">✕</button>`:'')+`</div>`}).join('');
 document.querySelectorAll('#rtWps input').forEach(inp=>inp.oninput=()=>sugerir(inp.value));
 document.querySelectorAll('#rtWps [data-up]').forEach(b=>b.onclick=()=>{readWps();const i=+b.dataset.up;if(i>1){[wps[i-1],wps[i]]=[wps[i],wps[i-1]];drawWps()}});
 document.querySelectorAll('#rtWps [data-dn]').forEach(b=>b.onclick=()=>{readWps();const i=+b.dataset.dn;if(i<wps.length-2){[wps[i+1],wps[i]]=[wps[i],wps[i+1]];drawWps()}});
 document.querySelectorAll('#rtWps [data-rm]').forEach(b=>b.onclick=()=>{readWps();wps.splice(+b.dataset.rm,1);drawWps()});
}
async function cargarDatos(){
 if(typeof AP!=='undefined'&&!AP){const r=await fetch('airports.json');if(!r.ok)throw new Error('airports');AP=await r.json()}
 if(!GRID){const r=await fetch('declinacion.json');if(!r.ok)throw new Error('declinacion');GRID=await r.json()}
}
function sugerir(q){
 q=String(q||'').trim().toUpperCase();const dl=$('rtDl');if(q.length<2||typeof AP==='undefined'||!AP){if(dl)dl.innerHTML='';return}
 const o=[];for(const k in AP){const a=AP[k];if(k.startsWith(q)||String(a[2]).toUpperCase().includes(q)||String(a[3]||'').toUpperCase().includes(q)){o.push(k);if(o.length>300)break}}
 o.sort((x,y)=>((AP[y][4]==='CL')-(AP[x][4]==='CL'))||((y.startsWith(q))-(x.startsWith(q)))||x.localeCompare(y));
 dl.innerHTML=o.slice(0,10).map(k=>`<option value="${E(k)}">${E(AP[k][2])}${AP[k][3]?' · '+E(AP[k][3]):''}</option>`).join('');
}
function avionActual(){const v=$('rtAv').value;if(v===OTRO)return $('rtOtroN').value.trim()||'Otro avión';return FLOTA[+v][0]}
async function calcular(){
 readWps();msg('');
 const cods=wps.filter(c=>c);if(wps.some(c=>!c)||cods.length<2)return msg('Completa salida, destino y los puntos intermedios (o quita los vacíos).','err');
 try{await cargarDatos()}catch(e){return msg('No pude cargar los datos de aeródromos o de declinación magnética.','err')}
 const falta=cods.find(c=>!/^[A-Z0-9]{3,4}$/.test(c)||!AP[c]);if(falta)return msg('No encuentro "'+falta+'" en la base de aeródromos.','err');
 const vav=Number($('rtV').value);if(!(vav>=30&&vav<=600))return msg('Escribe una VAV entre 30 y 600 kt.','err');
 const alt=Number($('rtAlt').value);if(!(alt>=0&&alt<=60000))return msg('La altitud debe estar entre 0 y 60.000 ft.','err');
 const pts=cods.map(c=>({c,lat:AP[c][0],lon:AP[c][1]}));
 for(let i=0;i<pts.length-1;i++)if(pts[i].c===pts[i+1].c)return msg('Dos puntos consecutivos son iguales ('+pts[i].c+').','err');
 const legs=calcRuta(pts,vav);lastLegs=legs;lastPts=pts;
 const tot=legs[legs.length-1];
 $('rtOut').innerHTML=`<p><b>${Math.round(tot.accD)} NM</b> · <b>${hhmm(tot.acc)}</b> de vuelo · VAV ${Math.round(vav)} kt · ${Math.round(alt).toLocaleString('es-CL')} ft · ${E(avionActual())}</p>
 <table class="rt"><thead><tr><th>#</th><th>Tramo</th><th style="text-align:right">Rumbo mag.</th><th style="text-align:right">Dist. (NM)</th><th style="text-align:right">Tiempo</th><th style="text-align:right">Acumulado</th></tr></thead><tbody>`+
 legs.map((l,i)=>`<tr><td>${i+1}</td><td><b>${E(l.de)}</b> → <b>${E(l.a)}</b></td><td style="text-align:right">${hdg(l.mh)}°</td><td style="text-align:right">${l.d.toFixed(1)}</td><td style="text-align:right">${hhmm(l.t)}</td><td style="text-align:right">${hhmm(l.acc)}</td></tr>`).join('')+
 `<tr><td></td><td><b>Total</b></td><td></td><td style="text-align:right"><b>${tot.accD.toFixed(1)}</b></td><td style="text-align:right"><b>${hhmm(tot.acc)}</b></td><td></td></tr></tbody></table>
 <p class="hint">Rumbo magnético = rumbo verdadero en el punto medio de cada tramo menos la declinación (WMM2025). Tiempos sin viento ni tiempo de rodaje o circuito.</p>`;
 $('rtSave').style.display='';
 if(!$('rtNom').value)$('rtNom').value=cods[0]+' – '+cods[cods.length-1];
 dibujar(pts);
}
async function dibujar(pts){
 try{await loadLeaflet()}catch(e){return}
 const el=$('rtMap');el.style.display='block';
 if(!map){map=L.map('rtMap',{scrollWheelZoom:false});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap'}).addTo(map)}
 if(layer)layer.remove();layer=L.layerGroup().addTo(map);
 const all=[];
 for(let i=0;i<pts.length-1;i++){const a=[pts[i].lat,pts[i].lon],b=[pts[i+1].lat,pts[i+1].lon],g=gcPts(a,b,Math.max(4,Math.min(80,Math.round(distNM(a,b)/10))));g.forEach(p=>all.push(p));L.polyline(g,{color:'#c2306e',weight:3,opacity:.9}).addTo(layer)}
 pts.forEach((p,i)=>{L.marker([p.lat,p.lon]).addTo(layer).bindTooltip((i+1)+'. '+p.c+(AP[p.c]?' · '+AP[p.c][2]:''),{permanent:true,direction:'top'})});
 setTimeout(()=>{map.invalidateSize();map.fitBounds(L.latLngBounds(all),{padding:[40,40]})},50);
}
function copiar(){
 if(!lastLegs)return;const t=lastLegs[lastLegs.length-1];
 const txt=['Plan de ruta · '+avionActual()+' · VAV '+$('rtV').value+' kt · '+$('rtAlt').value+' ft','']
  .concat(lastLegs.map((l,i)=>`${i+1}. ${l.de}→${l.a}  RM ${hdg(l.mh)}°  ${l.d.toFixed(1)} NM  ${hhmm(l.t)}  (acum. ${hhmm(l.acc)})`))
  .concat(['','Total: '+t.accD.toFixed(1)+' NM · '+hhmm(t.acc)]).join('\n');
 const ok=()=>msg('Resumen copiado.','ok'),fail=()=>msg('No pude copiar. Selecciona la tabla y cópiala manualmente.','err');
 if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(ok,fail);else fail();
}

/* ---------- guardado (Supabase, tabla rutas) ---------- */
async function guardar(){
 if(!lastPts||!user||!sb)return;msg('');
 const nombre=$('rtNom').value.trim();if(!nombre)return msg('Ponle un nombre a la ruta.','err');
 const v=$('rtAv').value,row={nombre,puntos:lastPts.map(p=>p.c),avion:avionActual(),vav:Number($('rtV').value),altitud:Math.round(Number($('rtAlt').value)),updated_at:new Date().toISOString()};
 let r;
 if(editId)r=await sb.from('rutas').update(row).eq('id',editId).select('id').single();
 else r=await sb.from('rutas').insert(row).select('id').single();
 if(r.error)return msg('No pude guardar la ruta: '+r.error.message,'err');
 editId=r.data.id;msg('Ruta guardada.','ok');cargarLista();
}
async function cargarLista(){
 if(!sb||!user)return;
 const r=await sb.from('rutas').select('id,nombre,puntos,avion,vav,altitud,updated_at').order('updated_at',{ascending:false}).limit(100);
 if(r.error){saved=[];$('rtList').textContent='No pude cargar tus rutas: '+r.error.message;return}
 saved=r.data||[];drawList();
}
function drawList(){
 const box=$('rtList');if(!box)return;
 if(!saved.length){box.textContent='Aún no has guardado rutas.';return}
 box.className='';
 box.innerHTML=saved.map(s=>`<div class="rt-saved"><span><b>${E(s.nombre)}</b><br><span class="hint">${E((s.puntos||[]).join(' → '))} · ${E(s.avion||'')} · ${s.vav?Math.round(s.vav)+' kt':''} · ${s.altitud!=null?Number(s.altitud).toLocaleString('es-CL')+' ft':''}</span></span><span style="white-space:nowrap"><button class="btn ghost small" data-load="${E(s.id)}" type="button">Abrir</button> <button class="btn ghost small" data-del="${E(s.id)}" type="button">Eliminar</button></span></div>`).join('');
 box.querySelectorAll('[data-load]').forEach(b=>b.onclick=()=>abrir(b.dataset.load));
 box.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>eliminar(b.dataset.del));
}
function abrir(id){
 const s=saved.find(x=>x.id===id);if(!s)return;
 editId=s.id;wps=(s.puntos||[]).slice();$('rtNom').value=s.nombre;
 const i=typeof FLOTA!=='undefined'?FLOTA.findIndex(f=>f[0]===s.avion):-1,sel=$('rtAv');
 if(i>=0)sel.value=String(i);else{sel.value=OTRO;$('rtOtroN').value=s.avion||''}
 sel.onchange();if(s.vav)$('rtV').value=s.vav;if(s.altitud!=null)$('rtAlt').value=s.altitud;
 drawWps();calcular();window.scrollTo({top:0,behavior:'smooth'});
}
async function eliminar(id){
 const s=saved.find(x=>x.id===id);if(!s||!confirm('¿Eliminar la ruta "'+s.nombre+'"?'))return;
 const r=await sb.from('rutas').delete().eq('id',id);
 if(r.error)return msg('No pude eliminar: '+r.error.message,'err');
 if(editId===id)editId=null;cargarLista();
}

/* ---------- entrada desde index.html ---------- */
window.rutaOpen=function(){
 try{build();cargarDatos().catch(()=>{});cargarLista()}catch(e){console.error('ruta',e)}
};
})();
