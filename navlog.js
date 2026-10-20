/* NavLog: fin del crepúsculo civil (FCCV) y exportación de la navegación a PDF (plantilla A4 vertical). */
(function(root){
'use strict';
const RAD=Math.PI/180,DEG=180/Math.PI;

/* ---------- fin del crepúsculo civil (sol 6° bajo el horizonte), algoritmo NOAA ---------- */
function julian(y,m,d){if(m<=2){y-=1;m+=12}const A=Math.floor(y/100),B=2-A+Math.floor(A/4);return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(m+1))+d+B-1524.5}
function solar(T){const L0=(280.46646+T*(36000.76983+T*0.0003032))%360,M=357.52911+T*(35999.05029-0.0001537*T),e=0.016708634-T*(0.000042037+0.0000001267*T),Mr=M*RAD,
 C=Math.sin(Mr)*(1.914602-T*(0.004817+0.000014*T))+Math.sin(2*Mr)*(0.019993-0.000101*T)+Math.sin(3*Mr)*0.000289,
 om=(125.04-1934.136*T)*RAD,lam=(L0+C-0.00569-0.00478*Math.sin(om))*RAD,
 eps=(23+(26+(21.448-T*(46.815+T*(0.00059-T*0.001813)))/60)/60+0.00256*Math.cos(om))*RAD,
 dec=Math.asin(Math.sin(eps)*Math.sin(lam)),y=Math.tan(eps/2)**2,L=L0*RAD,
 eq=4*DEG*(y*Math.sin(2*L)-2*e*Math.sin(Mr)+4*e*y*Math.sin(Mr)*Math.cos(2*L)-0.5*y*y*Math.sin(4*L)-1.25*e*e*Math.sin(2*Mr));
 return{dec,eq}}
/* Devuelve minutos UTC desde las 00:00 UTC de la fecha (puede salir fuera de 0–1440), o null si no hay crepúsculo ese día. */
function civilDusk(lat,lon,y,m,d){const jd0=julian(y,m,d);let t=1080-4*lon;
 for(let i=0;i<3;i++){const s=solar((jd0+t/1440-2451545)/36525),c=(Math.cos(96*RAD)-Math.sin(lat*RAD)*Math.sin(s.dec))/(Math.cos(lat*RAD)*Math.cos(s.dec));if(c<-1||c>1)return null;const ha=Math.acos(c)*DEG;t=720-4*(lon-ha)-s.eq}
 return t}
function tzDe(ap){if(!ap||ap[4]!=='CL')return null;if(ap[1]<-100)return'Pacific/Easter';if(ap[0]<-48.2)return'America/Punta_Arenas';return'America/Santiago'}
/* ap=[lat,lon,nombre,ciudad,pais]; fecha 'YYYY-MM-DD'. Devuelve 'HH:MM LT' (Chile) o 'HH:MM Z'. */
function fccv(ap,fecha){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha||'');if(!ap||!m)return'';const y=+m[1],mo=+m[2],d=+m[3],mins=civilDusk(ap[0],ap[1],y,mo,d);if(mins==null)return'';
 const dt=new Date(Date.UTC(y,mo-1,d)+Math.round(mins)*60000),tz=tzDe(ap);
 if(!tz){return String(dt.getUTCHours()).padStart(2,'0')+':'+String(dt.getUTCMinutes()).padStart(2,'0')+' Z'}
 return new Intl.DateTimeFormat('es-CL',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false}).format(dt).replace(/^24:/,'00:')+' LT'}

/* ---------- datos de la navegación (según la plantilla) ---------- */
const pad2=n=>String(n).padStart(2,'0'),hm=min=>pad2(Math.floor(min/60))+':'+pad2(min%60);
const h3=d=>{const r=Math.round(d)%360;return String(r===0?360:r).padStart(3,'0')};
const f1=n=>(Math.round(n*10)/10).toFixed(1).replace('.',',');
/* legs: salida de calcRuta (con tr = minutos redondeados). o: {vav,altitud,consumo,extra,hora,tosHoraEnMin} */
function filas(legs,o){let ac=0,tm=0,fb=0;const dr=legs.map(l=>Math.round(l.d)),tot=dr.reduce((a,b)=>a+b,0),et=o.horaMin;
 return legs.map((l,i)=>{ac+=dr[i];tm+=l.tr;return{
  nombre:(o.nombres&&o.nombres[i])||l.a,cusR:h3(l.tc),alt:o.altitud,cusMg:h3(l.mh),
  p:dr[i],a:ac,r:i===legs.length-1?'':tot-ac,vt:Math.round(o.vav),te:l.tr,tt:hm(tm),
  he:et==null?'':hm((et+tm)%1440),fb:o.consumo>0?f1(o.consumo*tm/60):'',obs:(o.notas&&o.notas[i])||''}})}

/* ---------- PDF ---------- */
function build(jsPDF,D){
 const doc=new jsPDF({orientation:'portrait',unit:'pt',format:'a4'}),PW=595.28,PH=841.89,M=18,W=PW-2*M,txt=s=>String(s==null?'':s);
 const G1=[217,217,217],G2=[200,200,200],YL=[255,255,0],GN=[198,239,206],BL=[0,32,160],BK=[0,0,0];
 doc.setLineWidth(0.5);doc.setDrawColor(0);
 const cell=(x,y,w,h,t,o)=>{o=o||{};if(o.fill){doc.setFillColor.apply(doc,o.fill);doc.rect(x,y,w,h,'FD')}else doc.rect(x,y,w,h,'S');
  if(t===''||t==null)return;doc.setFont('helvetica',o.bold===false?'normal':'bold');doc.setFontSize(o.size||7.5);doc.setTextColor.apply(doc,o.color||BK);
  let s=txt(t);while(s.length>1&&doc.getTextWidth(s)>w-5)s=s.slice(0,-1);const al=o.align||'center',tx=al==='left'?x+3:al==='right'?x+w-3:x+w/2;doc.text(s,tx,y+h/2+(o.size||7.5)*0.35,{align:al})};
 let y=M;
 /* franja superior */
 cell(M,y,W,12,D.titulo||'',{fill:G1,size:7,color:[60,60,60]});y+=12;
 /* encabezado: izquierda */
 const wl=W*0.585,gap=6,wr=W-wl-gap,rh=15,lw=wl*0.30,vw=wl*0.20,qw=wl*0.13;
 [['DESDE',D.desde],['HASTA',D.hasta],['ALTERNATIVA',D.alternativa]].forEach((r,i)=>{const yy=y+i*rh;
  cell(M,yy,lw,rh,r[0],{fill:G1,size:6.5,align:'right'});cell(M+lw,yy,vw,rh,r[1],{size:9});cell(M+lw+vw,yy,qw,rh,'QNH',{fill:G1,size:6.5});cell(M+lw+vw+qw,yy,wl-lw-vw-qw,rh,'')});
 cell(M,y+3*rh,lw,rh,'COMB. NECESARIO',{fill:G1,size:6.5,align:'right'});cell(M+lw,y+3*rh,vw,rh,D.comb,{size:9});
 cell(M+lw+vw,y+3*rh,wl-lw-vw,rh,D.combNota,{fill:YL,size:6.5,align:'left'});
 /* encabezado: derecha */
 const rx=M+wl+gap,c1=wr*0.36,c2=wr*0.20,c3=wr*0.14,c4=wr-c1-c2-c3;
 const R=[[['TACÓMETRO DESP.',1],['',0],['Vt Est.',1],[D.vt,2]],[['',0],['',0],['T Est.',1],[D.tTot,2]],[['HORA DESPEGUE',1],[D.hora,0],['FCCV',1],[D.fccv,3]],[['',0],['',0],['Fecha',1],[D.fecha,3]]];
 R.forEach((row,i)=>{let x=rx;[c1,c2,c3,c4].forEach((w,k)=>{const c=row[k];const o=c[1]===1?{fill:G1,size:6.5}:c[1]===2?{size:10,color:BL}:{size:c[1]===3?8.5:8};if(k===0&&c[1]===1)o.align='right';
  if(k===1&&row[0][0]===''){cell(x,y+i*rh,w,rh,'')}else cell(x,y+i*rh,w,rh,c[0],o);x+=w})});
 y+=4*rh+3;
 /* tabla principal */
 const cw=[98,26,30,28,26,26,26,28,28,38,34,34,38];cw.push(W-cw.reduce((a,b)=>a+b,0));
 const cx=[M];cw.forEach((w,i)=>cx.push(cx[i]+w));
 const hh=13,hdr1=y;
 const span=(a,b)=>[cx[a],cx[b+1]-cx[a]];
 let s;
 s=span(0,2);cell(s[0],hdr1,s[1],hh,'RUTA',{fill:G1,size:6.5});
 cell(cx[3],hdr1,cw[3],hh,'CUS',{fill:G1,size:6.5});
 s=span(4,6);cell(s[0],hdr1,s[1],hh,'DISTANCIAS',{fill:G1,size:6.5});
 cell(cx[7],hdr1,cw[7],hh,'VT EST.',{fill:G1,size:6});
 s=span(9,12);cell(s[0],hdr1,s[1],hh,'TIEMPOS',{fill:G1,size:6.5});
 cell(cx[13],hdr1,cw[13],hh*2,'OBSERVACIONES',{fill:G1,size:6.5});
 const h2=hdr1+hh;
 ['FIN DE TRAMO','CUS R','ALT','MG','Parcial','Acum.','Remain.','(KT)','T. EST','T. TOT. EST','H. ESTIM','H.REAL','F. BURNED'].forEach((t,i)=>cell(cx[i],h2,cw[i],hh,t,{fill:G1,size:(i===9||i===6)?5.2:6}));
 /* filas */
 const nRows=Math.max(D.filas.length,28),nAd=Math.max(16,D.ads.length);
 let rowH=15.5,bh=14;
 const need=()=>12+4*rh+3+hh*2+nRows*rowH+4+bh*(2+nAd)+14,avail=PH-2*M;
 if(need()>avail){const k=avail/need();rowH=Math.max(9,rowH*k);bh=Math.max(9,bh*k)}
 let yy=h2+hh;
 for(let i=0;i<nRows;i++){const f=D.filas[i]||null,vals=f?[f.nombre,f.cusR,f.alt,f.cusMg,f.p,f.a,f.r,f.vt,f.te,f.tt,f.he,'',f.fb,f.obs]:['','','','','','','','','','','','','',''];
  vals.forEach((v,k)=>{const fill=(k>=3&&k<=7)?G2:null,o={fill,size:k===0?7.5:7.5,align:k===0?'left':k===13?'left':'center'};if(k===7)o.color=BL;if(k===13)o.size=6;if(k===9)o.bold=true;cell(cx[k],yy,cw[k],rowH,v,o)});yy+=rowH}
 /* inferior */
 yy+=4;const by=yy,bw=W*0.455,gx=6,rx2=M+bw+gx,rw=W-bw-gx;
 /* izquierda: frecuencias */
 cell(M,by,bw,bh,'FRECUENCIAS',{fill:G1,size:7});
 const fw=[bw*0.34,bw*0.16,bw*0.26,bw*0.24];const fx=[M];fw.forEach((w,i)=>fx.push(fx[i]+w));
 ['Dependencia','Frec.','NAV','Frec.'].forEach((t,i)=>cell(fx[i],by+bh,fw[i],bh,t,{size:6.5}));
 for(let r=0;r<8;r++)fw.forEach((w,i)=>cell(fx[i],by+bh*(2+r),w,bh,''));
 let ly=by+bh*10;
 cell(M,ly,bw,bh,'METAR',{fill:[150,200,230],size:7,align:'left'});ly+=bh;
 for(let r=0;r<3;r++){cell(M,ly,bw,bh,'');ly+=bh}
 cell(M,ly,bw,bh,'OBSERVACIONES',{fill:G1,size:7,align:'left'});ly+=bh;
 const oRows=3+(nAd-16),lines=doc.setFont('helvetica','normal').setFontSize(6.5).splitTextToSize(pdfSafe(D.obs||''),bw-6).slice(0,oRows);
 for(let r=0;r<oRows;r++){cell(M,ly,bw,bh,'');if(lines[r]){doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(0);doc.text(lines[r],M+3,ly+bh/2+2.3)}ly+=bh}
 /* derecha: información de pistas */
 cell(rx2,by,rw,bh,'INFORMACION DE PISTAS',{fill:G1,size:7});
 const pw=[rw*0.14,rw*0.12,rw*0.12,rw*0.14,rw*0.2];pw.push(rw-pw.reduce((a,b)=>a+b,0));const px=[rx2];pw.forEach((w,i)=>px.push(px[i]+w));
 ['AD','RWY','SFC','ELEV','RMK','DIM'].forEach((t,i)=>cell(px[i],by+bh,pw[i],bh,t,{size:6.5,fill:i===0?G1:null}));
 for(let r=0;r<nAd;r++)pw.forEach((w,i)=>cell(px[i],by+bh*(2+r),w,bh,i===0?(D.ads[r]||''):'',{fill:i===0&&D.ads[r]?GN:null,size:7.5}));
 /* pie */
 doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(0);
 doc.text('NOTIF. POSICIÓN: MATRIC. / POS. / HORA / FL / COND. / POS. SGTE / HORA / POS. SUBSGTE',PW/2,PH-M-3,{align:'center'});
 return doc}
function pdfSafe(s){return String(s==null?'':s).replace(/[–—−]/g,'-').replace(/[·•]/g,'-').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/…/g,'...').replace(/[^\x20-\x7E -ÿ]/g,'')}

const api={civilDusk,fccv,tzDe,filas,build,hm,f1,h3,pdfSafe};
if(typeof module!=='undefined')module.exports=api;else root.NavlogPdf=api;
})(typeof window!=='undefined'?window:this);
