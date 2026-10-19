// Crea el cobro en Mercado Pago (Checkout Pro) y devuelve la URL de pago.
// Secrets: MP_ACCESS_TOKEN, APP_URL (ej. https://lolivab.github.io/bitacora/)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'
const PLANES: Record<string,{precio:number,titulo:string}> = {
  lifetime:{precio:29990,titulo:'Maletín de vuelo · Acceso de por vida'},
  anual:{precio:9990,titulo:'Maletín de vuelo · Acceso por 12 meses'},
}
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  try{
    const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')??''}}})
    const{data:{user}}=await sb.auth.getUser()
    if(!user)return new Response(JSON.stringify({error:'No autenticado'}),{status:401,headers:cors})
    const{plan,cupon,accion}=await req.json()
    const p=PLANES[plan]
    const code=String(cupon??'').trim().toUpperCase()
    let precio=p?.precio
    if(code){
      const adm=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      const{data:c}=await adm.from('cupones').select('precio,usos,usos_max,activo').eq('codigo',code).maybeSingle()
      if(!c||!c.activo||(c.usos_max!=null&&c.usos>=c.usos_max))return new Response(JSON.stringify({error:'Cupón no válido o agotado'}),{status:400,headers:cors})
      precio=Math.min(c.precio,p?.precio??c.precio)
      if(accion==='validar')return new Response(JSON.stringify({precio:c.precio}),{headers:{...cors,'Content-Type':'application/json'}})
    }
    if(!p)return new Response(JSON.stringify({error:'Plan inválido'}),{status:400,headers:cors})
    if(code&&precio===0){
      // Cupón 100%: no pasa por Mercado Pago. Se canjea y se activa el acceso aquí mismo.
      const adm=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      const{data:c}=await adm.from('cupones').select('usos').eq('codigo',code).maybeSingle()
      const u=await adm.from('cupones').update({usos:(c?.usos??0)+1}).eq('codigo',code).eq('usos',c?.usos??0).select('codigo')
      if(u.error||!u.data?.length)return new Response(JSON.stringify({error:'Cupón no válido o agotado'}),{status:400,headers:cors})
      await adm.from('pagos').insert({mp_payment_id:`cupon-${code}-${user.id}`,user_id:user.id,plan,monto:0})
      const{data:a}=await adm.from('accesos').select('plan,hasta').eq('user_id',user.id).maybeSingle()
      if(plan==='lifetime')await adm.from('accesos').upsert({user_id:user.id,plan:'lifetime',hasta:null})
      else if(!(a&&!a.hasta)){const b=a?.hasta&&new Date(a.hasta)>new Date()?new Date(a.hasta):new Date();b.setDate(b.getDate()+365);await adm.from('accesos').upsert({user_id:user.id,plan:'anual',hasta:b.toISOString()})}
      return new Response(JSON.stringify({gratis:true}),{headers:{...cors,'Content-Type':'application/json'}})
    }
    const app=(Deno.env.get('APP_URL')??'').replace(/\/?$/,'/')
    const r=await fetch('https://api.mercadopago.com/checkout/preferences',{method:'POST',
      headers:{'Authorization':'Bearer '+Deno.env.get('MP_ACCESS_TOKEN'),'Content-Type':'application/json'},
      body:JSON.stringify({
        items:[{title:p.titulo,quantity:1,unit_price:precio,currency_id:'CLP'}],
        external_reference:`${user.id}|${plan}|${code}`,
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
