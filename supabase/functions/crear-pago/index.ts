// Crea el cobro en Mercado Pago (Checkout Pro) y devuelve la URL de pago.
// Secrets: MP_ACCESS_TOKEN, APP_URL (ej. https://lolivab.github.io/bitacora/)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'
const PLANES: Record<string,{precio:number,titulo:string}> = {
  lifetime:{precio:29990,titulo:'Bitácora de vuelo · Acceso de por vida'},
  anual:{precio:5990,titulo:'Bitácora de vuelo · Acceso por 12 meses'},
}
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  try{
    const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')??''}}})
    const{data:{user}}=await sb.auth.getUser()
    if(!user)return new Response(JSON.stringify({error:'No autenticado'}),{status:401,headers:cors})
    const{plan}=await req.json()
    const p=PLANES[plan]
    if(!p)return new Response(JSON.stringify({error:'Plan inválido'}),{status:400,headers:cors})
    const app=(Deno.env.get('APP_URL')??'').replace(/\/?$/,'/')
    const r=await fetch('https://api.mercadopago.com/checkout/preferences',{method:'POST',
      headers:{'Authorization':'Bearer '+Deno.env.get('MP_ACCESS_TOKEN'),'Content-Type':'application/json'},
      body:JSON.stringify({
        items:[{title:p.titulo,quantity:1,unit_price:p.precio,currency_id:'CLP'}],
        external_reference:`${user.id}|${plan}`,
        payer:{email:user.email},
        notification_url:Deno.env.get('SUPABASE_URL')+'/functions/v1/mp-webhook',
        back_urls:{success:app+'?pago=ok',pending:app+'?pago=pendiente',failure:app+'?pago=error'},
        auto_return:'approved',
      })})
    const j=await r.json()
    if(!r.ok)return new Response(JSON.stringify({error:'Mercado Pago: '+(j.message||r.status)}),{status:502,headers:cors})
    return new Response(JSON.stringify({init_point:j.init_point}),{headers:{...cors,'Content-Type':'application/json'}})
  }catch(e){return new Response(JSON.stringify({error:String(e)}),{status:500,headers:cors})}
})
