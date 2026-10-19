// Proxy de cámaras de Windy: lee la clave desde la tabla app_config (windy_key) y consulta la API desde el servidor.
// Despliegue: supabase functions deploy camaras
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const J=(o:unknown,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{...cors,'Content-Type':'application/json'}})
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  try{
    const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')??''}}})
    const{data:{user}}=await sb.auth.getUser()
    if(!user)return J({error:'No autenticado'},401)
    const{lat=-33.45,lon=-70.66,radio=100}=await req.json().catch(()=>({}))
    const adm=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const{data:c}=await adm.from('app_config').select('valor').eq('clave','windy_key').maybeSingle()
    if(!c)return J({error:'Falta la clave de Windy en app_config'},500)
    const r=await fetch(`https://api.windy.com/webcams/api/v3/webcams?nearby=${Number(lat)},${Number(lon)},${Math.min(250,Number(radio)||100)}&limit=50&include=images,location,urls&lang=es`,{headers:{'x-windy-api-key':c.valor.trim()}})
    const txt=await r.text()
    if(!r.ok)return J({error:'Windy respondió '+r.status+(r.status===401||r.status===403?' (clave no válida)':''),detalle:txt.slice(0,200)},502)
    return new Response(txt,{headers:{...cors,'Content-Type':'application/json'}})
  }catch(e){return J({error:String(e)},500)}
})
