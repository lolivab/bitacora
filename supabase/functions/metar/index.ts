// Proxy de METAR (aviationweather.gov) para el navegador, que no puede consultarlo directo por CORS.
// Despliegue: supabase functions deploy metar
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const J=(o:unknown,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{...cors,'Content-Type':'application/json'}})
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  try{
    const{id=''}=await req.json().catch(()=>({}))
    const c=String(id).trim().toUpperCase()
    if(!/^[A-Z]{4}$/.test(c))return J({error:'Código ICAO inválido'},400)
    const r=await fetch(`https://aviationweather.gov/api/data/metar?ids=${c}&format=json&hours=24`)
    if(!r.ok)return J({error:'aviationweather.gov respondió '+r.status},502)
    const t=await r.text()
    let m:unknown[]=[];try{m=t?JSON.parse(t):[]}catch(_){}
    return J({metars:Array.isArray(m)?m:[]})
  }catch(e){return J({error:String(e)},500)}
})
