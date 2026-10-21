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
function calcRuta(pts,vav){let acc=0,accD=0,accR=0;const legs=[];for(let i=0;i<pts.length-1;i++){const a=[pts[i].lat,pts[i].lon],b=[pts[i+1].lat,pts[i+1].lon],d=distNM(a,b),m=midpoint(a,b),tc=bearing(m,b),v=decl(m[0],m[1]),mh=(tc-v+720)%360,t=vav>0?d/vav*60:0,tr=Math.round(t);acc+=t;accD+=d;accR+=tr;legs.push({de:pts[i].c,a:pts[i+1].c,tc,v,mh,d,t,tr,acc,accD,accR})}return legs}

/* ---------- perfil vertical (funciones puras) ---------- */
const M2FT=3.28084;
const elevFt=(r,g,b)=>Math.max(0,(r*256+g+b/256-32768)*M2FT); /* Terrarium (AWS Terrain Tiles): metros -> pies, océano = 0 */
function tileXY(lat,lon,z){const n=2**z,la=Math.max(-85.0511,Math.min(85.0511,lat))*RAD,fx=((lon+180)/360)*n,fy=(1-Math.log(Math.tan(la)+1/Math.cos(la))/Math.PI)/2*n,x=Math.min(n-1,Math.max(0,Math.floor(fx))),y=Math.min(n-1,Math.max(0,Math.floor(fy)));return{x,y,px:Math.min(255,Math.floor((fx-x)*256)),py:Math.min(255,Math.floor((fy-y)*256))}}
/* Puntos equiespaciados a lo largo de toda la ruta (círculo máximo por tramo), con distancia acumulada en NM. */
function muestrear(pts){const legs=[];let tot=0;for(let i=0;i<pts.length-1;i++){const d=distNM([pts[i].lat,pts[i].lon],[pts[i+1].lat,pts[i+1].lon]);legs.push(d);tot+=d}
 const step=Math.max(0.5,tot/300),out=[];let base=0;
 for(let i=0;i<legs.length;i++){const n=Math.max(1,Math.ceil(legs[i]/step)),g=gcPts([pts[i].lat,pts[i].lon],[pts[i+1].lat,pts[i+1].lon],n);for(let k=(i?1:0);k<=n;k++)out.push({lat:g[k][0],lon:((g[k][1]+540)%360)-180,d:base+legs[i]*k/n});base+=legs[i]}
 return{pts:out,total:tot,cum:legs.reduce((a,d)=>(a.push((a.length?a[a.length-1]:0)+d),a),[0])}}
/* e: terreno (ft) en cada muestra; alt: altitud de crucero (ft MSL); rc/rd: ft/min; vav: kt. */
function perfilCalc(sm,e,vav,alt,rc,rd,cams){
 const D=sm.total,e0=e[0],e1=e[e.length-1],k=vav/60,
  cs=(cams||[]).filter(c=>c&&isFinite(c.alt)&&c.d>0&&c.d<D-1e-9).sort((a,b)=>a.d-b.d);
 let top=alt,dc,dd,llega=true,key,at,avisos=[],marcas=[];
 if(!cs.length){
  dc=alt>e0?(alt-e0)/rc*k:0;dd=alt>e1?(alt-e1)/rd*k:0;
  if(dc+dd>D){llega=false;top=Math.max(Math.max(e0,e1),(D/k+e0/rc+e1/rd)/(1/rc+1/rd));dc=Math.max(0,(top-e0)/rc*k);dd=Math.max(0,(top-e1)/rd*k)}
  at=d=>d<dc?e0+(top-e0)*(dc?d/dc:1):d>D-dd?e1+(top-e1)*(dd?(D-d)/dd:1):top;
  key=[[0,at(0)],[dc,top],[D-dd,top],[D,at(D)]];
 }else{
  dc=alt>e0?(alt-e0)/rc*k:0;key=[[0,dc?e0:alt],[dc,alt]];
  let cur=alt,ult=dc;
  cs.forEach(c=>{const dh=c.alt-cur;if(Math.abs(dh)<1){return}
   const dur=Math.abs(dh)/(dh>0?rc:rd)*k,s0=Math.max(c.modo==='cru'?c.d-dur:c.d,ult),fin=Math.min(D,s0+dur);
   if(c.modo==='cru'&&s0+dur>c.d+0.05)avisos.push({d:c.d,falta:s0+dur-c.d,alt:c.alt});
   if(s0>ult+1e-9)key.push([Math.min(D,s0),cur]);
   key.push([fin,c.alt]);marcas.push({d:c.d,d0:Math.min(D,s0),d1:fin,alt:c.alt,modo:c.modo,sube:dh>0});
   top=Math.max(top,c.alt);cur=c.alt;ult=fin});
  dd=cur>e1?(cur-e1)/rd*k:0;const sd=Math.max(ult,D-dd);
  if(sd>D-dd+0.05)avisos.push({d:D,falta:sd-(D-dd),alt:null});
  key.push([Math.min(D,sd),cur]);key.push([D,dd?e1:cur]);dd=Math.max(0,D-sd);
  at=d=>{if(d<=key[0][0])return key[0][1];for(let i=1;i<key.length;i++)if(d<=key[i][0]){const a=key[i-1],b=key[i],w=b[0]-a[0];return w<1e-9?b[1]:a[1]+(b[1]-a[1])*(d-a[0])/w}return key[key.length-1][1]};
 }
 const path=sm.pts.map(p=>at(p.d)),marg=path.map((h,i)=>h-e[i]);
 let minM=Infinity,minD=0,bajo=0;sm.pts.forEach((p,i)=>{if(p.d<3||p.d>D-3)return;if(marg[i]<minM){minM=marg[i];minD=p.d}if(marg[i]<1000)bajo++});
 return{dc,dd,top,llega,path,marg,minM:minM===Infinity?null:minM,minD,bajo,tMax:Math.max.apply(null,e),tocMin:dc/k,todMin:dd/k,D,key,avisos,marcas}}
/* altitud objetivo de cada tramo: "ini" en el punto de partida del tramo, "cru" en el punto de llegada. cams[i] alineado con los puntos. */
function altsTramos(alt,cams,nPts){const o=[];let cur=alt;for(let j=0;j<nPts-1;j++){const a=cams&&cams[j],b=cams&&cams[j+1];
 if(j>0&&a&&a.modo==='ini'&&isFinite(a.alt))cur=a.alt;
 if(j+1<nPts-1&&b&&b.modo==='cru'&&isFinite(b.alt))cur=b.alt;o.push(cur)}return o}

/* ---------- viento estimado (funciones puras) ---------- */
/* niv: [{h (m MSL), s (kt), d (° de donde sopla)}]. Interpola por componentes a la altura altM. */
function vientoInterp(niv,altM){const n=niv.filter(x=>x&&isFinite(x.h)&&isFinite(x.s)&&isFinite(x.d)).sort((a,b)=>a.h-b.h);if(!n.length)return null;
 const uv=x=>[-x.s*Math.sin(x.d*RAD),-x.s*Math.cos(x.d*RAD)];let a=n[0],b=n[0],t=0;
 if(altM>=n[n.length-1].h){a=b=n[n.length-1]}else if(altM>n[0].h){for(let i=0;i<n.length-1;i++)if(altM>=n[i].h&&altM<=n[i+1].h){a=n[i];b=n[i+1];t=(altM-a.h)/((b.h-a.h)||1);break}}
 const A=uv(a),B=uv(b),u=A[0]+(B[0]-A[0])*t,v=A[1]+(B[1]-A[1])*t,spd=Math.hypot(u,v);
 return{spd,dir:spd<0.5?0:(Math.atan2(-u,-v)*DEG+360)%360}}
/* >0 = viento de frente (HW), <0 = de cola (TW). */
const compFrente=(spd,dir,curso)=>spd*Math.cos((dir-curso)*RAD);
/* distancias (NM) donde se estima el viento: 0, cada paso y el final si queda un tramo largo. */
function distViento(D,paso){const o=[];for(let d=0;d<=D+1e-9;d+=paso)o.push(d);if(D-o[o.length-1]>=paso/2)o.push(D);return o}
if(typeof module!=='undefined')module.exports={distNM,bearing,midpoint,decl,calcRuta,hhmm,hdg,elevFt,tileXY,muestrear,perfilCalc,altsTramos,vientoInterp,compFrente,distViento,_setGrid:g=>{GRID=g}};
if(typeof document==='undefined')return;

/* ---------- interfaz ---------- */
const $=id=>document.getElementById(id);
const E=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lastIn=null,lastP=null,built=false,map=null,layer=null,wps=['',''],cams=[null,null],lastCams=null,lastAlts=null,editId=null,saved=[],lastLegs=null,lastPts=null;
const OTRO='__otro__';

function build(){
 const s=$('s-ruta');if(!s||built)return;built=true;
 s.innerHTML=`<style>
 #s-ruta .rt-wp{display:flex;gap:6px;align-items:center;margin-bottom:6px}
 #s-ruta .rt-wp input{flex:1;text-transform:uppercase;min-width:0}
 #s-ruta .rt-wp .rt-n{width:22px;text-align:center;font-weight:600;color:var(--muted,#667)}
 #s-ruta .rt-wp{flex-wrap:wrap}
 #s-ruta .rt-cm{display:flex;gap:8px;flex:0 0 calc(100% - 28px);box-sizing:border-box;max-width:calc(100% - 28px);margin:0 0 6px 28px}
 #s-ruta .rt-cm select{flex:1;min-width:0}
 #s-ruta .rt-cm input{flex:0 0 96px;min-width:0;text-transform:none}
 @media(max-width:520px){#s-ruta .rt-wp{margin-bottom:10px;gap:8px}#s-ruta .rt-cm{margin-top:-2px}#s-ruta .rt-wp .rt-mini{min-width:38px;padding:8px}}
 #s-ruta .rt-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
 #s-ruta .rt-chip{padding:2px 8px;border-radius:12px;border:1px solid var(--line,#ccc);font-size:.85em;font-weight:600}
 #s-ruta .rt-chip.ok{border-color:#2e8b57;color:#2e8b57}
 #s-ruta .rt-chip.bad{border-color:#c0392b;background:#c0392b;color:#fff}
 #s-ruta .rt-bad{border-color:#c0392b!important;outline:1px solid #c0392b}
 #s-ruta .rt-gchips{display:flex;flex-wrap:wrap;gap:8px}
 #s-ruta .rt-gchip{display:inline-flex;flex-direction:column;min-width:92px;padding:6px 10px;border:1px solid var(--line,#ccc);border-radius:10px;line-height:1.25}
 #s-ruta .rt-gchip b{font-size:1.15em;color:var(--ink,inherit)}
 #s-ruta .rt-gl{font-size:.72em;text-transform:uppercase;letter-spacing:.03em;opacity:.7}
 #s-ruta .rt-gs{font-size:.78em;opacity:.75}
 #s-ruta .rt-mini{padding:4px 8px;min-width:32px}
 #s-ruta table.rt td,#s-ruta table.rt th{white-space:nowrap}
 #s-ruta .rt-saved{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--line,#ddd)}
 </style>
 <div class="card" style="max-width:900px">
  <h2>Plan de ruta <span class="hint" style="font-weight:400">· NavLog (en pruebas, solo administrador)</span></h2>
  <p class="hint">Ingresa salida, destino y puntos intermedios (por ahora, aeródromos con código ICAO). Rumbos magnéticos con modelo WMM2025. Es una ayuda de planificación: no reemplaza el briefing ni la información oficial vigente (AIP, NOTAM).</p>
 <div class="field"><label for="rtTxt">Ruta: escribe los códigos separados por espacio</label><textarea id="rtTxt" rows="2" placeholder="Ej. SCTB SCSF SCSE" autocomplete="off" autocapitalize="characters" spellcheck="false" style="text-transform:uppercase;width:100%;box-sizing:border-box"></textarea><div id="rtChips" class="rt-chips" aria-live="polite"></div></div>
  <p class="hint" style="margin-top:0">Primero la salida, al final el destino. Abajo puedes ajustar cada punto y agregar cambios de altitud.</p>
  <div id="rtWps"></div>
  <p><button class="btn ghost small" id="rtAdd" type="button">+ Punto intermedio</button></p>
  <datalist id="rtDl"></datalist>
  <div class="form">
   <div class="field"><label for="rtAv">Avión</label><select id="rtAv"></select></div>
   <div class="field"><label for="rtV">VAV (kt) — editable</label><input id="rtV" type="number" min="30" max="600" step="1" inputmode="numeric"></div>
   <div class="field"><label for="rtAlt">Altitud inicial (ft)</label><input id="rtAlt" type="number" min="0" max="60000" step="500" value="5500" inputmode="numeric"></div>
   <div class="field"><label for="rtRc">Ascenso (ft/min)</label><input id="rtRc" type="number" min="100" max="5000" step="50" value="700" inputmode="numeric"></div>
   <div class="field"><label for="rtRd">Descenso (ft/min)</label><input id="rtRd" type="number" min="100" max="5000" step="50" value="500" inputmode="numeric"></div>
  </div>
  <div class="field" id="rtOtroBox" style="display:none"><label for="rtOtroN">Nombre del avión (opcional)</label><input id="rtOtroN" maxlength="20" placeholder="Ej. C-150"></div>
  <p><button class="btn" id="rtGo" type="button">Calcular ruta</button></p>
  <div id="rtMsg"></div>
  <div id="rtMap" style="display:none;height:380px;border:1px solid var(--line,#ddd);border-radius:8px;margin:10px 0"></div>
  <div id="rtGps" style="display:none;margin:-4px 0 10px"><p style="margin:4px 0"><button class="btn ghost small" id="rtGpsBtn" type="button">📍 Mi posición</button> <label class="hint" style="white-space:nowrap"><input type="checkbox" id="rtGpsSig" checked> Seguir en el mapa</label></p><div id="rtGpsInfo" class="hint">Activa tu ubicación para ver el avión sobre el mapa. Necesita permiso de ubicación y la pantalla encendida.</div></div>
  <div id="rtOut" style="overflow-x:auto"></div>
  <div id="rtProf" style="margin-top:12px"></div>
  <div id="rtExp" class="card" style="display:none;margin:14px 0;padding:12px">
   <h3 style="margin:0 0 6px">Exportar navegación (PDF)</h3>
   <div class="form">
    <div class="field"><label for="rtAlter">Alternativa (ICAO)</label><input id="rtAlter" maxlength="4" list="rtDl" placeholder="Opcional" style="text-transform:uppercase" autocomplete="off"></div>
    <div class="field"><label for="rtFecha">Fecha del vuelo</label><input id="rtFecha" type="date"></div>
    <div class="field"><label for="rtHora">Hora de despegue (opcional)</label><input id="rtHora" type="time"></div>
    <div class="field"><label for="rtCons">Consumo (gal/h, opcional)</label><input id="rtCons" type="number" min="0" max="500" step="0.1" inputmode="decimal"></div>
    <div class="field"><label for="rtExtra">Combustible extra / reserva (gal)</label><input id="rtExtra" type="number" min="0" max="2000" step="0.5" inputmode="decimal"></div>
   </div>
   <div class="field"><label for="rtObs">Observaciones (se imprimen en el PDF)</label><input id="rtObs" maxlength="200" placeholder="Ej. R-1: 3000-FL090 | VIÑA APP 129,30"></div>
   <p><button class="btn" id="rtPdf" type="button">Descargar PDF</button></p>
   <p class="hint">Hora de despegue y fecha en hora local. Sin consumo, las columnas de combustible quedan en blanco. Las frecuencias, pistas y METAR se completan a mano en el formulario.</p>
  </div>
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
 $('rtAdd').onclick=()=>{readWps();if(wps.length>=20)return;wps.splice(wps.length-1,0,'');cams.splice(wps.length-2,0,null);drawWps()};
 $('rtGpsBtn').onclick=gpsToggle;$('rtGo').onclick=calcular;$('rtPdf').onclick=exportarPdf;{const t=new Date();$('rtFecha').value=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0')}
 $('rtSv').onclick=guardar;$('rtCp').onclick=copiar;
 $('rtNew').onclick=()=>{editId=null;wps=['',''];cams=[null,null];$('rtNom').value='';$('rtOut').innerHTML='';$('rtProf').innerHTML='';$('rtSave').style.display='none';$('rtExp').style.display='none';$('rtMap').style.display='none';msg('');drawWps();drawList()};
 $('rtTxt').oninput=desdeTexto;$('rtTxt').onfocus=()=>{txtFoco=true;pintarChips()};$('rtTxt').onblur=()=>{txtFoco=false;pintarChips()};
 cargarDatos().then(pintarChips,()=>{});
 drawWps();
}
function msg(t,k){const m=$('rtMsg');if(m)m.innerHTML=t?`<div class="msg ${k||''}">${E(t)}</div>`:''}
function readCams(n){return Array.from({length:n},(_,i)=>{const q=document.querySelector('#rtWps [data-cm="'+i+'"]'),a=document.querySelector('#rtWps [data-ca="'+i+'"]');return q&&q.value?{modo:q.value,alt:a&&a.value!==''?Number(a.value):NaN}:null})}
function readWps(){const r=[...document.querySelectorAll('#rtWps input[data-i]')].map(i=>i.value.trim().toUpperCase());if(r.length){wps=r;cams=readCams(r.length)}}
/* ---- texto libre: mayúsculas, validación al cerrar cada código con espacio ---- */
let txtFoco=false;
const parseTxt=v=>String(v||'').toUpperCase().split(/[\s,;]+/).filter(Boolean).slice(0,20);
function valido(c){return typeof AP!=='undefined'&&AP?!!AP[c]:null}
function pintarChips(){
 const ta=$('rtTxt'),box=$('rtChips');if(!ta||!box)return;
 const toks=parseTxt(ta.value),cierre=/[\s,;]$/.test(ta.value)||!txtFoco;
 box.innerHTML=toks.map((c,i)=>{const hecho=i<toks.length-1||cierre,v=hecho?valido(c):null;
  return`<span class="rt-chip ${v===true?'ok':v===false?'bad':''}" title="${v===true?E(AP[c][2]):v===false?'Aeródromo no encontrado':''}">${E(c)}${v===false?' ✕':''}</span>`}).join('');
 document.querySelectorAll('#rtWps input[data-i]').forEach(inp=>{const c=inp.value.trim().toUpperCase(),hecho=document.activeElement!==inp;inp.classList.toggle('rt-bad',!!c&&hecho&&valido(c)===false)})}
function desdeTexto(){
 const ta=$('rtTxt'),up=ta.value.toUpperCase();
 if(up!==ta.value){const p=ta.selectionStart;ta.value=up;try{ta.setSelectionRange(p,p)}catch(e){}}
 const old=readCams(wps.length),t=parseTxt(up);
 wps=t.length>=2?t:t.concat(Array(2-t.length).fill(''));
 cams=wps.map((_,i)=>old[i]||null);
 drawWps(true);pintarChips();
 if(typeof AP!=='undefined'&&!AP)cargarDatos().then(pintarChips,()=>{})}
function drawWps(desdeTxt){
 const last=wps.length-1;cams.length=wps.length;for(let i=0;i<cams.length;i++)if(cams[i]===undefined)cams[i]=null;
 $('rtWps').innerHTML=wps.map((c,i)=>{const lab=i===0?'Salida':i===last?'Destino':'Punto '+i,cm=cams[i],mid=i>0&&i<last;return`<div class="rt-wp"><span class="rt-n">${i+1}</span><input list="rtDl" maxlength="4" placeholder="${lab} (ICAO)" value="${E(c)}" aria-label="${lab}" data-i="${i}" autocomplete="off">`+
 (mid?`<button class="btn ghost small rt-mini" type="button" data-up="${i}" title="Subir">↑</button><button class="btn ghost small rt-mini" type="button" data-dn="${i}" title="Bajar">↓</button><button class="btn ghost small rt-mini" type="button" data-rm="${i}" title="Quitar">✕</button>`:'')+
 (mid?`<div class="rt-cm"><select data-cm="${i}" aria-label="Cambio de altitud en ${E(c||lab)}"><option value="">Sin cambio de altitud</option><option value="ini"${cm&&cm.modo==='ini'?' selected':''}>Iniciar cambio de altitud a…</option><option value="cru"${cm&&cm.modo==='cru'?' selected':''}>Cruzar a…</option></select><input type="number" min="0" max="60000" step="500" inputmode="numeric" placeholder="ft" data-ca="${i}" value="${cm&&isFinite(cm.alt)?cm.alt:''}" aria-label="Altitud del cambio (ft)"${cm?'':' style="display:none"'}></div>`:'')+`</div>`}).join('');
 {const ta=$('rtTxt');if(ta&&!desdeTxt)ta.value=wps.filter(Boolean).join(' ');pintarChips()}
 document.querySelectorAll('#rtWps input[data-i]').forEach(inp=>{inp.oninput=()=>{sugerir(inp.value);const ta=$('rtTxt');if(ta){ta.value=[...document.querySelectorAll('#rtWps input[data-i]')].map(x=>x.value.trim().toUpperCase()).filter(Boolean).join(' ');pintarChips()}};inp.onblur=pintarChips});
 document.querySelectorAll('#rtWps [data-cm]').forEach(q=>q.onchange=()=>{const a=document.querySelector('#rtWps [data-ca="'+q.dataset.cm+'"]');a.style.display=q.value?'':'none';if(q.value)a.focus()});
 document.querySelectorAll('#rtWps [data-up]').forEach(b=>b.onclick=()=>{readWps();const i=+b.dataset.up;if(i>1){[wps[i-1],wps[i]]=[wps[i],wps[i-1]];[cams[i-1],cams[i]]=[cams[i],cams[i-1]];drawWps()}});
 document.querySelectorAll('#rtWps [data-dn]').forEach(b=>b.onclick=()=>{readWps();const i=+b.dataset.dn;if(i<wps.length-2){[wps[i+1],wps[i]]=[wps[i],wps[i+1]];[cams[i+1],cams[i]]=[cams[i],cams[i+1]];drawWps()}});
 document.querySelectorAll('#rtWps [data-rm]').forEach(b=>b.onclick=()=>{readWps();wps.splice(+b.dataset.rm,1);cams.splice(+b.dataset.rm,1);drawWps()});
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
 readWps();msg('');lastP=null;
 const cods=wps.filter(c=>c);if(wps.some(c=>!c)||cods.length<2)return msg('Completa salida, destino y los puntos intermedios (o quita los vacíos).','err');
 try{await cargarDatos()}catch(e){return msg('No pude cargar los datos de aeródromos o de declinación magnética.','err')}
 const falta=cods.find(c=>!/^[A-Z0-9]{3,4}$/.test(c)||!AP[c]);if(falta)return msg('No encuentro "'+falta+'" en la base de aeródromos.','err');
 const vav=Number($('rtV').value);if(!(vav>=30&&vav<=600))return msg('Escribe una VAV entre 30 y 600 kt.','err');
 const alt=Number($('rtAlt').value);if(!(alt>=0&&alt<=60000))return msg('La altitud debe estar entre 0 y 60.000 ft.','err');
 const rc=Number($('rtRc').value),rd=Number($('rtRd').value);if(!(rc>=100&&rc<=5000)||!(rd>=100&&rd<=5000))return msg('Ascenso y descenso deben estar entre 100 y 5.000 ft/min.','err');
 const pts=cods.map(c=>({c,lat:AP[c][0],lon:AP[c][1]}));
 let cm=[];for(let i=0;i<pts.length;i++){const c=cams[i];if(!c||i===0||i===pts.length-1){cm.push(null);continue}if(!(c.alt>=0&&c.alt<=60000))return msg('Punto '+(i+1)+' ('+pts[i].c+'): escribe la altitud del cambio (0 a 60.000 ft).','err');cm.push({modo:c.modo,alt:Math.round(c.alt)})}
 lastCams=cm;lastAlts=altsTramos(alt,cm,pts.length);
 for(let i=0;i<pts.length-1;i++)if(pts[i].c===pts[i+1].c)return msg('Dos puntos consecutivos son iguales ('+pts[i].c+').','err');
 const legs=calcRuta(pts,vav);lastLegs=legs;lastPts=pts;
 const tot=legs[legs.length-1];
 $('rtOut').innerHTML=`<p><b>${Math.round(tot.accD)} NM</b> · <b>${hhmm(tot.accR)}</b> de vuelo · VAV ${Math.round(vav)} kt · ${Math.round(alt).toLocaleString('es-CL')} ft · ${E(avionActual())}</p>
 <table class="rt"><thead><tr><th>#</th><th>Tramo</th><th style="text-align:right">Alt. (ft)</th><th style="text-align:right">Rumbo mag.</th><th style="text-align:right">Dist. (NM)</th><th style="text-align:right">Tiempo</th><th style="text-align:right">Acumulado</th></tr></thead><tbody>`+
 legs.map((l,i)=>`<tr><td>${i+1}</td><td><b>${E(l.de)}</b> → <b>${E(l.a)}</b>${cm[i+1]?` <span class="hint">(${cm[i+1].modo==='cru'?'cruzar '+E(l.a)+' a':'iniciar cambio en '+E(l.a)+' a'} ${cm[i+1].alt.toLocaleString('es-CL')} ft)</span>`:''}</td><td style="text-align:right">${Math.round(lastAlts[i]).toLocaleString('es-CL')}</td><td style="text-align:right">${hdg(l.mh)}°</td><td style="text-align:right">${l.d.toFixed(1)}</td><td style="text-align:right">${hhmm(l.tr)}</td><td style="text-align:right">${hhmm(l.accR)}</td></tr>`).join('')+
 `<tr><td></td><td><b>Total</b></td><td></td><td></td><td style="text-align:right"><b>${tot.accD.toFixed(1)}</b></td><td style="text-align:right"><b>${hhmm(tot.accR)}</b></td><td></td></tr></tbody></table>
 <p class="hint">Rumbo magnético = rumbo verdadero en el punto medio de cada tramo menos la declinación (WMM2025). Tiempos por tramo redondeados al minuto, sin viento ni rodaje o circuito.</p>`;
 $('rtSave').style.display='';$('rtExp').style.display='';lastIn={avion:avionActual(),vav,alt};
 if(!$('rtNom').value)$('rtNom').value=cods[0]+' – '+cods[cods.length-1];
 dibujar(pts);perfil(pts,vav,alt,rc,rd);
}
async function dibujar(pts){
 try{await loadLeaflet()}catch(e){return}
 const el=$('rtMap');el.style.display='block';
 if(!map){map=L.map('rtMap',{scrollWheelZoom:false});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap'}).addTo(map)}
 if(layer)layer.remove();layer=L.layerGroup().addTo(map);
 const all=[];
 for(let i=0;i<pts.length-1;i++){const a=[pts[i].lat,pts[i].lon],b=[pts[i+1].lat,pts[i+1].lon],g=gcPts(a,b,Math.max(4,Math.min(80,Math.round(distNM(a,b)/10))));g.forEach(p=>all.push(p));L.polyline(g,{color:'#c2306e',weight:3,opacity:.9}).addTo(layer)}
 pts.forEach((p,i)=>{L.marker([p.lat,p.lon]).addTo(layer).bindTooltip(p.c,{permanent:true,direction:'top'})});
 $('rtGps').style.display='';
 setTimeout(()=>{map.invalidateSize();map.fitBounds(L.latLngBounds(all),{padding:[40,40]})},50);
}
function copiar(){
 if(!lastLegs)return;const t=lastLegs[lastLegs.length-1];
 const txt=['Plan de ruta · '+avionActual()+' · VAV '+$('rtV').value+' kt · '+$('rtAlt').value+' ft','']
  .concat(lastLegs.map((l,i)=>`${i+1}. ${l.de}→${l.a}  ${lastAlts?Math.round(lastAlts[i])+' ft  ':''}RM ${hdg(l.mh)}°  ${l.d.toFixed(1)} NM  ${hhmm(l.tr)}  (acum. ${hhmm(l.accR)})`))
  .concat(['','Total: '+t.accD.toFixed(1)+' NM · '+hhmm(t.accR)]).join('\n');
 const ok=()=>msg('Resumen copiado.','ok'),fail=()=>msg('No pude copiar. Selecciona la tabla y cópiala manualmente.','err');
 if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(ok,fail);else fail();
}


/* ---------- perfil vertical (terreno + ruta) ---------- */
const tileCache=new Map();
function cargarTile(z,x,y){const k=z+'/'+x+'/'+y;if(tileCache.has(k))return tileCache.get(k);
 const p=new Promise((res,rej)=>{const im=new Image();im.crossOrigin='anonymous';im.onload=()=>{try{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);res(g.getImageData(0,0,256,256).data)}catch(e){rej(e)}};im.onerror=()=>rej(new Error('tile '+k));im.src='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/'+k+'.png'});
 p.catch(()=>tileCache.delete(k));tileCache.set(k,p);return p}
async function terrenoEn(pts){
 let z=pts.length&&pts[pts.length-1].d>600?8:pts[pts.length-1].d>200?9:10,keys;
 for(;;){keys=new Set(pts.map(p=>{const t=tileXY(p.lat,p.lon,z);return z+'/'+t.x+'/'+t.y}));if(keys.size<=60||z<=6)break;z--}
 const data={};await Promise.all([...keys].map(async k=>{const[zz,x,y]=k.split('/').map(Number);data[k]=await cargarTile(zz,x,y)}));
 return pts.map(p=>{const t=tileXY(p.lat,p.lon,z),d=data[z+'/'+t.x+'/'+t.y],i=(t.py*256+t.px)*4;return elevFt(d[i],d[i+1],d[i+2])})}
const nice=(v,n)=>{const r=v/n,m=10**Math.floor(Math.log10(r)),f=r/m;return(f<=1?1:f<=2?2:f<=5?5:10)*m};
let profTok=0,geom=null;
async function perfil(pts,vav,alt,rc,rd){
 const box=$('rtProf'),tok=++profTok;box.innerHTML='<p class="hint">Cargando terreno…</p>';
 let sm,e;try{sm=muestrear(pts);e=await terrenoEn(sm.pts)}catch(err){if(tok===profTok)box.innerHTML='<div class="msg err">No pude cargar el terreno para el perfil vertical (necesita conexión a internet).</div>';return}
 if(tok!==profTok)return;
 const P=perfilCalc(sm,e,vav,alt,rc,rd,(lastCams||[]).map((c,i)=>c?{d:sm.cum[i],alt:c.alt,modo:c.modo}:null));P.e=e;P.sm=sm;P.alt=alt;lastP=P;
 const fl=n=>Math.round(n).toLocaleString('es-CL');
 let alerta='';const nomP=d=>{let j=0;while(j<pts.length-1&&sm.cum[j]<d-0.5)j++;return pts[j].c};
 P.avisos.forEach(a=>{alerta+=`<div class="msg err">${a.alt==null?'No alcanza a descender hasta el destino':'No alcanza a completar el cambio a '+fl(a.alt)+' ft antes de '+E(nomP(a.d))}: faltan ≈ ${a.falta.toFixed(0)} NM con el ritmo indicado.</div>`});
 if(P.minM!==null){if(P.minM<0)alerta+=`<div class="msg err">La ruta cruza el terreno (margen ${fl(P.minM)} ft cerca de la NM ${Math.round(P.minD)}). Sube la altitud o cambia la ruta.</div>`;
  else if(P.minM<1000)alerta+=`<div class="msg err">Margen sobre el terreno menor a 1.000 ft: mínimo ${fl(P.minM)} ft cerca de la NM ${Math.round(P.minD)}.</div>`;
  else alerta+=`<div class="msg ok">Margen mínimo sobre el terreno: ${fl(P.minM)} ft (cerca de la NM ${Math.round(P.minD)}).</div>`}
 box.innerHTML=`<h3 style="margin:8px 0">Perfil vertical</h3>
 <p>${P.llega?'':'<b>No alcanza la altitud elegida</b>: la ruta es muy corta; máxima ≈ '+fl(P.top)+' ft. '}Ascenso: <b>${P.dc.toFixed(0)} NM</b> · ${hhmm(P.tocMin)} · Crucero: <b>${Math.max(0,P.D-P.dc-P.dd).toFixed(0)} NM</b>${P.marcas.length?' (con '+P.marcas.length+' cambio(s) de altitud)':''} · Descenso: <b>${P.dd.toFixed(0)} NM</b> · ${hhmm(P.todMin)} · Terreno máx.: <b>${fl(P.tMax)} ft</b></p>${alerta}
 <svg id="rtSvg" viewBox="0 0 900 430" style="width:100%;height:auto;touch-action:none;color:inherit" role="img" aria-label="Perfil vertical de la ruta"></svg>
 <div id="rtRead" class="hint" style="min-height:1.4em">Toca o pasa el cursor sobre el gráfico para ver el detalle.</div>
 <p><button class="btn ghost small" id="rtWindBtn" type="button">Actualizar viento</button> <span id="rtWindMsg" class="hint"></span></p>
 <p class="hint">Terreno desde el modelo digital de elevación (AWS Terrain Tiles); es referencial y no incluye obstáculos. Ascenso y descenso con la VAV constante y los ritmos indicados (el tiempo de la tabla no cambia). Viento: modelo meteorológico (Open-Meteo) a la altitud de la ruta y a la hora estimada de cada punto, según la fecha y hora de despegue del bloque Exportar. Las flechas muestran hacia dónde sopla el viento relativo al rumbo del tramo al que corresponde cada punto: hacia la derecha es viento de cola, hacia la izquierda de frente, hacia abajo empuja hacia la derecha del avión. El texto es dirección de donde viene / nudos; HW = viento de frente, TW = de cola. Es referencial y no reemplaza el pronóstico oficial. Altitud en pies sobre el nivel del mar; salida y destino se toman a la elevación del terreno en el aeródromo.</p>`;
 dibujarPerfil(P,pts);
 $('rtWindBtn').onclick=()=>actualizarViento(P,vav);
 actualizarViento(P,vav,tok);
}
function dibujarPerfil(P,pts){
 const svg=$('rtSvg');if(!svg)return;
 const W=900,H=430,L=56,R=14,T=22,ph=244,pw=W-L-R,sm=P.sm,D=P.D,AX=T+ph;
 const yMaxRaw=Math.max(P.top,P.tMax)*1.12+500,ys=nice(yMaxRaw,5),yMax=Math.ceil(yMaxRaw/ys)*ys;
 const X=d=>L+d/D*pw,Y=h=>T+ph-(h/yMax)*ph,f=n=>n.toFixed(1);
 let g='';
 for(let v=0;v<=yMax;v+=ys)g+=`<line x1="${L}" x2="${W-R}" y1="${f(Y(v))}" y2="${f(Y(v))}" stroke="currentColor" opacity=".13"/><text x="${L-6}" y="${f(Y(v)+4)}" font-size="11" text-anchor="end" fill="currentColor" opacity=".7">${v.toLocaleString('es-CL')}</text>`;
 const xs=nice(D,6);for(let d=0;d<=D+0.01;d+=xs)g+=`<line x1="${f(X(d))}" x2="${f(X(d))}" y1="${T}" y2="${T+ph}" stroke="currentColor" opacity=".07"/><text x="${f(X(d))}" y="${AX+13}" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">${Math.round(d)}</text>`;
 g+=`<text x="${W/2}" y="${AX+54}" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">Distancia (NM)</text><text x="12" y="${T+ph/2}" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7" transform="rotate(-90 12 ${T+ph/2})">Altitud (ft)</text>`;
 const terr=sm.pts.map((p,i)=>f(X(p.d))+','+f(Y(P.e[i]))).join(' ');
 g+=`<polygon points="${f(X(0))},${f(Y(0))} ${terr} ${f(X(D))},${f(Y(0))}" fill="#b9a98a" fill-opacity=".85" stroke="#8a7a5c" stroke-width="1"/>`;
 const key=P.key;
 g+=`<polyline points="${key.map(k=>f(X(k[0]))+','+f(Y(k[1]))).join(' ')}" fill="none" stroke="#c2306e" stroke-width="2.5" stroke-linejoin="round"/>`;
 let red='';sm.pts.forEach((p,i)=>{if(i&&p.d>=3&&p.d<=D-3&&(P.marg[i]<1000||P.marg[i-1]<1000)&&sm.pts[i-1].d>=3)red+=`<line x1="${f(X(sm.pts[i-1].d))}" y1="${f(Y(P.path[i-1]))}" x2="${f(X(p.d))}" y2="${f(Y(P.path[i]))}"/>`});
 if(red)g+=`<g stroke="#d00" stroke-width="5" stroke-linecap="round" opacity=".9">${red}</g>`;
 const lab=(d,h,t,dy)=>`<circle cx="${f(X(d))}" cy="${f(Y(h))}" r="3.5" fill="#c2306e"/><text x="${f(X(d))}" y="${f(Y(h)+dy)}" font-size="11" text-anchor="middle" fill="currentColor">${t}</text>`;
 if(P.dc>0.5&&P.dc<D)g+=lab(P.dc,key[1][1],'TOC '+hhmm(P.tocMin),-8);
 if(P.dd>0.5&&D-P.dd>0)g+=lab(D-P.dd,key[key.length-2][1],'TOD',-8);
 P.marcas.forEach(m=>{g+=lab(m.d1,m.alt,Math.round(m.alt).toLocaleString('es-CL')+' ft',-8);g+=`<text x="${f(X(m.d))}" y="${f(Y(m.alt)+(m.sube?16:-20))}" font-size="10" text-anchor="middle" fill="currentColor" opacity=".75">${m.modo==='cru'?'cruzar':'iniciar'}</text>`});
 pts.forEach((p,i)=>{const d=sm.cum[i];g+=`<line x1="${f(X(d))}" x2="${f(X(d))}" y1="${T}" y2="${T+ph}" stroke="currentColor" opacity=".35" stroke-dasharray="4 4"/><text x="${f(Math.min(W-R-14,Math.max(L+14,X(d))))}" y="${T-6}" font-size="11" font-weight="600" text-anchor="middle" fill="currentColor">${E(p.c)}</text>`});
 {let ultX=-1e9,fila=0;pts.forEach((p,i)=>{const x=X(sm.cum[i]),cx=Math.min(W-R-16,Math.max(L+16,x));fila=(cx-ultX<38)?1-fila:0;ultX=cx;g+=`<path d="M${f(x-5)},${AX+8} L${f(x+5)},${AX+8} L${f(x)},${AX} Z" fill="#c2306e"/><text x="${f(cx)}" y="${AX+27+fila*12}" font-size="11" font-weight="700" text-anchor="middle" fill="currentColor">${E(p.c)}</text>`})}
 g+=`<g id="rtWind"><text x="${L}" y="${AX+74}" font-size="11" fill="currentColor" opacity=".7">Viento estimado: cargando…</text></g>`;
 g+=`<line id="rtCur" x1="0" x2="0" y1="${T}" y2="${T+ph}" stroke="currentColor" opacity=".6" style="display:none"/>`;
 svg.innerHTML=g;
 const rd=$('rtRead'),cur=$('rtCur');
 const move=ev=>{const r=svg.getBoundingClientRect(),c=ev.touches?ev.touches[0]:ev,x=(c.clientX-r.left)/r.width*W,d=Math.max(0,Math.min(D,(x-L)/pw*D));
  let i=0;while(i<sm.pts.length-1&&sm.pts[i+1].d<=d)i++;
  cur.style.display='';cur.setAttribute('x1',f(X(sm.pts[i].d)));cur.setAttribute('x2',f(X(sm.pts[i].d)));
  rd.textContent=`NM ${Math.round(sm.pts[i].d)} · Terreno ${Math.round(P.e[i]).toLocaleString('es-CL')} ft · Ruta ${Math.round(P.path[i]).toLocaleString('es-CL')} ft · Margen ${Math.round(P.marg[i]).toLocaleString('es-CL')} ft`};
 svg.onpointermove=move;svg.onpointerdown=move;
 geom={X,L,W,R,AX,D,Y,T,ph};gpsPerfil();
}


/* ---------- exportar navegación a PDF ---------- */
async function exportarPdf(){
 if(!lastLegs||!lastPts||!lastIn)return msg('Primero calcula la ruta.','err');
 if(!window.NavlogPdf)return msg('No pude cargar el generador de PDF. Recarga la página.','err');
 const N=window.NavlogPdf,T=s=>N.pdfSafe(s);
 const alt=$('rtAlter').value.trim().toUpperCase();if(alt&&(!/^[A-Z0-9]{3,4}$/.test(alt)||!AP[alt]))return msg('No encuentro la alternativa "'+alt+'" en la base de aeródromos.','err');
 const fecha=$('rtFecha').value,hora=$('rtHora').value,cons=Number($('rtCons').value)||0,extra=Number($('rtExtra').value)||0;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha))return msg('Elige la fecha del vuelo.','err');
 if(cons<0||extra<0)return msg('Consumo y combustible extra no pueden ser negativos.','err');
 let horaMin=null;if(hora){const m=/^(\d{2}):(\d{2})$/.exec(hora);if(!m)return msg('Hora de despegue inválida.','err');horaMin=+m[1]*60+ +m[2]}
 const notas={};
 (lastCams||[]).forEach((c,i)=>{if(c&&i>0){const t=(c.modo==='cru'?'Cruzar a ':'Inic. cambio a ')+c.alt;notas[i-1]=(notas[i-1]?notas[i-1]+' / ':'')+t}});
 if(lastP&&lastP.sm){const cum=lastP.sm.cum,at=x=>{for(let i=0;i<cum.length-1;i++)if(x>=cum[i]&&x<cum[i+1]+1e-9)return i;return cum.length-2};
  if(lastP.dc>0.5){const i=at(lastP.dc);notas[i]=(notas[i]?notas[i]+' / ':'')+'TOC'}
  if(lastP.dd>0.5){const i=at(lastP.D-lastP.dd);notas[i]=(notas[i]?notas[i]+' / ':'')+'TOD'}}
 const nombres=lastLegs.map(l=>{const a=AP[l.a];return (l.a+' '+String(a&&(a[3]||a[2])||'').toUpperCase()).trim()});
 const fil=N.filas(lastLegs,{vav:lastIn.vav,altitud:Math.round(lastIn.alt),alts:lastAlts,consumo:cons,horaMin,notas,nombres});
 const totMin=lastLegs[lastLegs.length-1].accR,quema=cons>0?cons*totMin/60:0,dest=lastPts[lastPts.length-1].c;
 const ads=[];lastPts.forEach(p=>{if(!ads.includes(p.c))ads.push(p.c)});if(alt&&!ads.includes(alt))ads.push(alt);
 const fc=N.fccv(AP[dest],fecha),fd=fecha.split('-');
 const D={titulo:T('NAVEGACIÓN · '+lastIn.avion+' · crucero '+Math.round(lastIn.alt).toLocaleString('es-CL')+' ft · VAV '+Math.round(lastIn.vav)+' kt'),
  desde:lastPts[0].c,hasta:dest,alternativa:alt,comb:cons>0?N.f1(quema+extra):'',combNota:cons>0&&extra>0?'< Incluye '+String(extra).replace('.',',')+' gal extra':'',
  vt:String(Math.round(lastIn.vav)),tTot:N.hm(totMin),hora:hora||'',fccv:fc?dest+'  '+fc:'',fecha:fd[2]+'/'+fd[1]+'/'+fd[0].slice(2),
  filas:fil,ads,obs:$('rtObs').value};
 try{
  await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',()=>window.jspdf&&window.jspdf.jsPDF);
  const doc=N.build(window.jspdf.jsPDF,D);
  doc.save('NavLog-'+lastPts[0].c+'-'+dest+'-'+fecha+'.pdf');msg('PDF descargado.','ok');
 }catch(e){msg('No pude generar el PDF: '+(e&&e.message||e),'err')}
}


/* ---------- viento estimado (Open-Meteo, niveles de presión) ---------- */
const NIVELES=[1000,975,950,925,900,850,800,700,600,500,400,300,250,200];
function tzSalida(){const c=lastPts&&lastPts[0]&&lastPts[0].c;return window.NavlogPdf&&AP&&AP[c]?window.NavlogPdf.tzDe(AP[c]):null}
function localAUtc(fecha,hora,tz){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha),h=/^(\d{2}):(\d{2})$/.exec(hora||'12:00');if(!m||!h)return null;
 const t=Date.UTC(+m[1],+m[2]-1,+m[3],+h[1],+h[2]);if(!tz)return t;
 const off=u=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(new Date(u)).reduce((a,x)=>(a[x.type]=x.value,a),{});return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)-u};
 let u=t-off(t);u=t-off(u);return u}
function inicioUtc(){ /* instante estimado de despegue (ms UTC) */
 const fecha=$('rtFecha')&&$('rtFecha').value,hora=$('rtHora')&&$('rtHora').value,tz=tzSalida(),n=new Date(),hoy=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');
 if(!fecha||fecha===hoy&&!hora)return Date.now();
 return localAUtc(fecha,hora||'12:00',tz)}
const NIV_BASE=[1000,925,850,700,500];
function nivelesPara(altMaxFt){const n=NIV_BASE.slice();if(altMaxFt>15000)n.push(400,300);if(altMaxFt>28000)n.push(250,200);return n}
const vCache=new Map();
/* Una consulta por punto (más liviana), solo las horas necesarias y los niveles de presión que importan. */
async function pedirPunto(c,hIni,hFin,niv){
 const vars=niv.flatMap(l=>['wind_speed_'+l+'hPa','wind_direction_'+l+'hPa','geopotential_height_'+l+'hPa']),
  url='https://api.open-meteo.com/v1/forecast?latitude='+c[0].toFixed(3)+'&longitude='+c[1].toFixed(3)+'&hourly='+vars.join(',')+'&wind_speed_unit=kn&timezone=GMT&start_hour='+hIni+'&end_hour='+hFin;
 if(vCache.has(url))return vCache.get(url);
 let ult='';for(let i=0;i<3;i++){let to;try{const ab=new AbortController();to=setTimeout(()=>ab.abort(),40000);const r=await fetch(url,{signal:ab.signal});clearTimeout(to);
  if(r.ok){const j=await r.json();vCache.set(url,j);return j}
  ult='HTTP '+r.status;if(r.status<500&&r.status!==429)break}catch(e){clearTimeout(to);ult=e.name==='AbortError'?'tiempo agotado':'sin conexión'}
  await new Promise(r=>setTimeout(r,1500*(i+1)))}
 throw new Error(ult)}
const hIso=ms=>new Date(ms).toISOString().slice(0,13)+':00';
async function cargarViento(P,vav,progreso){
 const t0=inicioUtc(),ahora=Date.now();if(t0==null)throw new Error('Fecha u hora inválidas');
 if(t0<ahora-36e5*24||t0>ahora+36e5*24*14)throw new Error('El pronóstico cubre desde hoy hasta 14 días adelante. Ajusta la fecha de vuelo.');
 const sm=P.sm,D=P.D,paso=D/50>39?Math.ceil(D/39/50)*50:50,ds=distViento(D,paso),legs=lastLegs;
 const idx=ds.map(d=>{let i=0;while(i<sm.pts.length-1&&sm.pts[i+1].d<=d)i++;return i}),
  curso=ds.map(d=>{const l=legs.find(x=>d<=x.accD+1e-9)||legs[legs.length-1];return l.tc});
 const tFin=t0+D/vav*36e5,hIni=hIso(Math.floor(t0/36e5)*36e5),hFin=hIso(Math.ceil(tFin/36e5)*36e5),niv=nivelesPara(Math.max(P.top,P.alt||0));
 const out=new Array(ds.length).fill(null);let hechos=0,fallos=0,ult='';
 const uno=async k=>{try{const j=await pedirPunto([sm.pts[idx[k]].lat,sm.pts[idx[k]].lon],hIni,hFin,niv),o=j.hourly,h=hIso(Math.round((t0+ds[k]/vav*36e5)/36e5)*36e5),jj=o&&o.time?o.time.indexOf(h):-1;if(jj<0)throw new Error('sin datos para esa hora');
   const n=niv.map(l=>({h:o['geopotential_height_'+l+'hPa']&&o['geopotential_height_'+l+'hPa'][jj],s:o['wind_speed_'+l+'hPa']&&o['wind_speed_'+l+'hPa'][jj],d:o['wind_direction_'+l+'hPa']&&o['wind_direction_'+l+'hPa'][jj]})),
   alt=P.path[idx[k]],w=vientoInterp(n,alt*0.3048);if(!w)throw new Error('sin datos');out[k]={d:ds[k],dir:w.dir,spd:w.spd,hw:compFrente(w.spd,w.dir,curso[k]),curso:curso[k],alt}}catch(e){fallos++;ult=e.message}
  hechos++;if(progreso)progreso({pts:out.slice(),paso,t0,hechos,total:ds.length,fallos})};
 let sig=0;await Promise.all([...Array(Math.min(3,ds.length))].map(async()=>{while(sig<ds.length){const k=sig++;await uno(k)}}));
 if(!out.some(Boolean))throw new Error(ult||'sin datos');
 return{pts:out,paso,t0,fallos}}
function pintarViento(W){
 const g=$('rtWind');if(!g||!geom)return;const{X,L,W:Wd,R,AX}=geom,f=n=>n.toFixed(1),y0=AX+112;
 if(W&&W.pts&&!W.pts.some(Boolean)&&!W.error){g.innerHTML=`<text x="${L}" y="${AX+74}" font-size="11" fill="currentColor" opacity=".7">Viento estimado: consultando (${W.hechos||0}/${W.total||''})…</text>`;return}
 if(!W||!W.pts||!W.pts.some(Boolean)){g.innerHTML=`<text x="${L}" y="${AX+74}" font-size="11" fill="#b00020">Viento no disponible${W&&W.error?': '+E(W.error):''}</text>`;return}
 let h=`<text x="${L}" y="${AX+74}" font-size="11" fill="currentColor" opacity=".7">Viento cada ${W.paso} NM a la altitud de la ruta (de donde viene / kt). Flechas relativas al rumbo del tramo de cada punto: → cola, ← frente</text>`;
 W.pts.forEach(p=>{if(!p)return;const x=Math.min(Wd-R-22,Math.max(L+22,X(p.d))),hw=p.hw,col=hw>=2?'#c0392b':hw<=-2?'#2e8b57':'currentColor',to=((p.dir+180-p.curso+90)%360+360)%360,
  tx=p.spd<0.5?'calma':hdg(p.dir)+'°/'+Math.round(p.spd),cp=Math.abs(hw)<2?'':(hw>0?'HW ':'TW ')+Math.round(Math.abs(hw));
  h+=(p.spd<0.5?`<circle cx="${f(x)}" cy="${y0}" r="4" fill="none" stroke="currentColor" opacity=".6"/>`:`<g transform="translate(${f(x)},${y0}) rotate(${f(to)})"><line x1="0" y1="13" x2="0" y2="-11" stroke="${col}" stroke-width="2"/><path d="M0,-15 L-5,-6 L5,-6 Z" fill="${col}"/></g>`)+
   `<text x="${f(x)}" y="${y0+28}" font-size="10.5" text-anchor="middle" fill="currentColor">${tx}</text><text x="${f(x)}" y="${y0+40}" font-size="10.5" font-weight="700" text-anchor="middle" fill="${col}">${cp}</text>`});
 g.innerHTML=h}
let vTok=0;
async function actualizarViento(P,vav,tok){
 const my=++vTok,msgEl=()=>$('rtWindMsg'),vivo=()=>my===vTok&&(tok===undefined||tok===profTok)&&$('rtWind');
 if(msgEl())msgEl().textContent='Consultando viento…';
 let W;try{W=await cargarViento(P,vav,pr=>{if(!vivo())return;pintarViento(pr);if(msgEl())msgEl().textContent='Consultando viento… '+pr.hechos+'/'+pr.total})}catch(e){W={error:e.message}}
 if(!vivo())return;
 pintarViento(W);
 if(msgEl())msgEl().textContent=W.error?'':'Hora base: '+new Date(W.t0).toLocaleString('es-CL',{dateStyle:'short',timeStyle:'short'})+' (hora de este dispositivo)'+(W.fallos?' · '+W.fallos+' punto(s) sin datos':'')}


/* ---------- posición GPS del dispositivo ---------- */
const gps={w:null,pos:null,hdg:null,prev:null,mk:null,ci:null,lock:null};
const avionSvg=h=>`<div style="width:36px;height:36px;transform:rotate(${Math.round(h||0)}deg);transition:transform .4s"><svg viewBox="0 0 32 32" width="36" height="36" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))"><path d="M16 2 L19 12 L30 19 L30 22 L19 18.5 L18.5 26 L22 28.5 L22 30 L16 28.5 L10 30 L10 28.5 L13.5 26 L13 18.5 L2 22 L2 19 L13 12 Z" fill="#1565c0" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg></div>`;
const iconoAvion=h=>L.divIcon({className:'',iconSize:[36,36],iconAnchor:[18,18],html:avionSvg(h)});
async function gpsToggle(){
 if(gps.w!=null)return gpsStop();
 if(!navigator.geolocation)return msg('Este navegador o dispositivo no ofrece GPS.','err');
 if(!map||typeof L==='undefined')return msg('Primero calcula la ruta para ver el mapa.','err');
 msg('');gps.prev=null;gps.hdg=null;
 $('rtGpsInfo').textContent='Buscando señal GPS…';$('rtGpsBtn').textContent='⏹ Detener GPS';
 gps.w=navigator.geolocation.watchPosition(gpsFix,gpsErr,{enableHighAccuracy:true,maximumAge:1000,timeout:30000});
 try{if(navigator.wakeLock)gps.lock=await navigator.wakeLock.request('screen')}catch(e){gps.lock=null}
}
function gpsStop(){
 if(gps.w!=null)navigator.geolocation.clearWatch(gps.w);gps.w=null;gps.pos=null;
 try{if(gps.lock)gps.lock.release()}catch(e){}gps.lock=null;
 if(gps.mk){gps.mk.remove();gps.mk=null}if(gps.ci){gps.ci.remove();gps.ci=null}
 const b=$('rtGpsBtn');if(b)b.textContent='📍 Mi posición';const i=$('rtGpsInfo');if(i)i.textContent='GPS detenido.';
 const m=document.getElementById('rtGpsMk');if(m)m.remove();
}
function gpsErr(e){
 const t=e&&e.code===1?'Permiso de ubicación denegado. Habilítalo en el navegador para este sitio.':e&&e.code===3?'Sin señal GPS por ahora; sigo intentando.':'No pude obtener la posición.';
 if(e&&e.code===1){gpsStop()}
 const i=$('rtGpsInfo');if(i)i.textContent=t}
/* distancia mínima (NM) del punto al tramo i de la ruta y el tramo más cercano */
function tramoCercano(pos){
 if(!lastPts)return null;let best=null;
 for(let i=0;i<lastPts.length-1;i++){const a=[lastPts[i].lat,lastPts[i].lon],b=[lastPts[i+1].lat,lastPts[i+1].lon],g=gcPts(a,b,Math.max(4,Math.min(60,Math.round(distNM(a,b)/5))));
  for(const q of g){const d=distNM(pos,q);if(!best||d<best.d)best={d,i}}}
 return best}
function gpsFix(p){
 const c=p.coords,pos=[c.latitude,c.longitude],acc=c.accuracy||0;
 const v=c.speed!=null&&isFinite(c.speed)?c.speed*1.94384:null;
 if(c.heading!=null&&isFinite(c.heading)&&(c.speed||0)>1)gps.hdg=c.heading;
 else if(gps.prev&&distNM(gps.prev,pos)>0.015){gps.hdg=bearing(gps.prev,pos)}
 if(!gps.prev||distNM(gps.prev,pos)>0.015)gps.prev=pos;
 gps.pos={lat:pos[0],lon:pos[1],acc,gs:v,alt:c.altitude!=null&&isFinite(c.altitude)?c.altitude*M2FT:null,t:p.timestamp};
 const ll=L.latLng(pos[0],pos[1]);
 if(!gps.mk){gps.mk=L.marker(ll,{icon:iconoAvion(gps.hdg),interactive:false,keyboard:false,zIndexOffset:1000}).addTo(map);gps.ci=L.circle(ll,{radius:acc,color:'#1565c0',weight:1,fillOpacity:.1}).addTo(map);
  map.on('dragstart',()=>{const s=$('rtGpsSig');if(s)s.checked=false});
  if($('rtGpsSig').checked)map.setView(ll,Math.max(map.getZoom(),10))}
 else{gps.mk.setLatLng(ll);gps.mk.setIcon(iconoAvion(gps.hdg));gps.ci.setLatLng(ll);gps.ci.setRadius(acc);if($('rtGpsSig').checked)map.panTo(ll)}
 gpsInfo();gpsPerfil()}
function gpsInfo(){
 const g=gps.pos,el=$('rtGpsInfo');if(!g||!el)return;
 const f=n=>Math.round(n).toLocaleString('es-CL'),hh=ms=>new Date(ms).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}),
  chip=(t,v,sub)=>`<span class="rt-gchip"><span class="rt-gl">${t}</span><b>${v}</b>${sub?`<span class="rt-gs">${sub}</span>`:''}</span>`;
 const t=tramoCercano([g.lat,g.lon]),ok=g.gs!=null&&g.gs>=30;let nx=null,dN=null,dD=null;
 if(t&&lastLegs){nx=lastPts[t.i+1];dN=distNM([g.lat,g.lon],[nx.lat,nx.lon]);dD=dN;for(let j=t.i+1;j<lastLegs.length;j++)dD+=lastLegs[j].d}
 const eta=d=>ok&&d!=null?hh(Date.now()+d/g.gs*3600000):'—',rest=d=>ok&&d!=null?hhmm(d/g.gs*60):'';
 let h='<div class="rt-gchips">'+chip('Ground Speed',g.gs!=null?f(g.gs)+' kt':'—')+
  chip('Rumbo',gps.hdg!=null?hdg(gps.hdg)+'°':'—',gps.hdg!=null?hdg(gps.hdg-decl(g.lat,g.lon))+'° mag.':'')+
  chip('Dist. a '+(nx?E(nx.c):'siguiente'),dN!=null?dN.toFixed(1)+' NM':'—')+
  chip('ETA '+(nx?E(nx.c):'siguiente'),eta(dN),rest(dN))+
  chip('ETA '+(lastPts?E(lastPts[lastPts.length-1].c):'destino'),eta(dD),dD!=null?(ok?rest(dD)+' · ':'')+dD.toFixed(0)+' NM':'')+'</div>';
 const x=[];if(g.alt!=null)x.push('Alt. GPS '+f(g.alt)+' ft');x.push('precisión ±'+f(g.acc*M2FT)+' ft');
 if(t&&nx)x.push('desvío del tramo '+E(lastPts[t.i].c)+'–'+E(nx.c)+': '+t.d.toFixed(1)+' NM');
 if(!ok)x.push('ETA disponible al superar 30 kt de velocidad');
 el.innerHTML=h+'<div style="margin-top:4px">'+x.join(' · ')+' · Referencial: no reemplaza los instrumentos.</div>'}
/* marca de posición en el perfil vertical */
function gpsPerfil(){
 const old=document.getElementById('rtGpsMk');if(old)old.remove();
 const svg=$('rtSvg');if(!svg||!geom||!geom.Y||!gps.pos||!lastP||!lastP.sm)return;
 const g=gps.pos,sm=lastP.sm,{X,Y,T,ph}=geom,f=n=>n.toFixed(1);
 let k=0,bd=Infinity;sm.pts.forEach((q,i)=>{const d=distNM([g.lat,g.lon],[q.lat,q.lon]);if(d<bd){bd=d;k=i}});
 if(bd>15)return; /* demasiado lejos de la ruta */
 const x=X(sm.pts[k].d),plan=lastP.path[k];
 let h=`<g id="rtGpsMk"><line x1="${f(x)}" x2="${f(x)}" y1="${T}" y2="${T+ph}" stroke="#1565c0" stroke-width="1.5" stroke-dasharray="3 3"/>`;
 h+=`<circle cx="${f(x)}" cy="${f(Y(plan))}" r="3" fill="none" stroke="#1565c0"/>`;
 if(g.alt!=null){const y=Math.max(T+4,Math.min(T+ph-4,Y(g.alt)));h+=`<g transform="translate(${f(x)},${f(y)}) rotate(90)">${avionSvg(0).replace(/<div[^>]*>/,'').replace('</div>','').replace('width="36" height="36"','width="22" height="22" x="-11" y="-11"')}</g>`}
 else h+=`<text x="${f(x)}" y="${T+12}" font-size="10" text-anchor="middle" fill="#1565c0">tú</text>`;
 svg.insertAdjacentHTML('beforeend',h+'</g>')}

/* ---------- guardado (Supabase, tabla rutas) ---------- */
async function guardar(){
 if(!lastPts||!user||!sb)return;msg('');
 const nombre=$('rtNom').value.trim();if(!nombre)return msg('Ponle un nombre a la ruta.','err');
 const v=$('rtAv').value,row={nombre,puntos:lastPts.map(p=>p.c),cambios:(lastCams&&lastCams.some(Boolean))?lastCams:null,avion:avionActual(),vav:Number($('rtV').value),altitud:Math.round(Number($('rtAlt').value)),alternativa:($('rtAlter').value.trim().toUpperCase()||null),consumo:Number($('rtCons').value)>0?Number($('rtCons').value):null,extra:Number($('rtExtra').value)>0?Number($('rtExtra').value):null,ascenso:Math.round(Number($('rtRc').value))||null,descenso:Math.round(Number($('rtRd').value))||null,updated_at:new Date().toISOString()};
 let r;
 if(editId)r=await sb.from('rutas').update(row).eq('id',editId).select('id').single();
 else r=await sb.from('rutas').insert(row).select('id').single();
 if(r.error)return msg('No pude guardar la ruta: '+r.error.message,'err');
 editId=r.data.id;msg('Ruta guardada.','ok');cargarLista();
}
async function cargarLista(){
 if(!sb||!user)return;
 const r=await sb.from('rutas').select('id,nombre,puntos,cambios,avion,vav,altitud,ascenso,descenso,alternativa,consumo,extra,updated_at').order('updated_at',{ascending:false}).limit(100);
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
 editId=s.id;wps=(s.puntos||[]).slice();cams=wps.map((_,i)=>(s.cambios&&s.cambios[i])||null);$('rtNom').value=s.nombre;
 const i=typeof FLOTA!=='undefined'?FLOTA.findIndex(f=>f[0]===s.avion):-1,sel=$('rtAv');
 if(i>=0)sel.value=String(i);else{sel.value=OTRO;$('rtOtroN').value=s.avion||''}
 sel.onchange();if(s.vav)$('rtV').value=s.vav;if(s.altitud!=null)$('rtAlt').value=s.altitud;$('rtAlter').value=s.alternativa||'';$('rtCons').value=s.consumo||'';$('rtExtra').value=s.extra||'';if(s.ascenso)$('rtRc').value=s.ascenso;if(s.descenso)$('rtRd').value=s.descenso;
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
