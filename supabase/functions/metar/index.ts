// Proxy de METAR y TAF (aviationweather.gov) para el navegador, que no puede consultarlo directo por CORS.
// Despliegue: supabase functions deploy metar
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const J=(o:unknown,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{...cors,'Content-Type':'application/json'}})
const get=async(u:string)=>{try{const r=await fetch(u);if(!r.ok)return{ok:false,s:r.status,d:[] as unknown[]};const t=await r.text();let d:unknown[]=[];try{d=t?JSON.parse(t):[]}catch(_){}return{ok:true,s:200,d:Array.isArray(d)?d:[]}}catch(_){return{ok:false,s:0,d:[] as unknown[]}}}
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  try{
    const{id=''}=await req.json().catch(()=>({}))
    const c=String(id).trim().toUpperCase()
    if(!/^[A-Z]{4}$/.test(c))return J({error:'Código ICAO inválido'},400)
    const[m,t]=await Promise.all([get(`https://aviationweather.gov/api/data/metar?ids=${c}&format=json&hours=24`),get(`https://aviationweather.gov/api/data/taf?ids=${c}&format=json`)])
    if(!m.ok&&!t.ok)return J({error:'aviationweather.gov respondió '+m.s},502)
    return J({metars:m.d,tafs:t.d})
  }catch(e){return J({error:String(e)},500)}
})
