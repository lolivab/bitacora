// Recibe avisos de Mercado Pago, valida la firma, confirma el pago y activa el acceso.
// Desplegar con --no-verify-jwt. Secrets: MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'
const PRECIOS: Record<string,number> = {lifetime:29990,anual:9990,cinco:29990}
const hex=(b:ArrayBuffer)=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')
async function firmaOk(req:Request,dataId:string){
  const sig=req.headers.get('x-signature')??'',rid=req.headers.get('x-request-id')??''
  const ts=/ts=([^,]+)/.exec(sig)?.[1],v1=/v1=([^,]+)/.exec(sig)?.[1]
  if(!ts||!v1)return false
  const manifest=`id:${dataId.toLowerCase()};request-id:${rid};ts:${ts};`
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(Deno.env.get('MP_WEBHOOK_SECRET')!),{name:'HMAC',hash:'SHA-256'},false,['sign'])
  return hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(manifest)))===v1
}
Deno.serve(async(req)=>{
  try{
    const url=new URL(req.url)
    let body:any={};try{body=await req.json()}catch(_){}
    const type=body.type??url.searchParams.get('type')??url.searchParams.get('topic')
    const dataId=String(body?.data?.id??url.searchParams.get('data.id')??url.searchParams.get('id')??'')
    if(type!=='payment'||!dataId)return new Response('ignorado',{status:200})
    if(!(await firmaOk(req,dataId)))return new Response('firma inválida',{status:401})
    const r=await fetch('https://api.mercadopago.com/v1/payments/'+dataId,{headers:{Authorization:'Bearer '+Deno.env.get('MP_ACCESS_TOKEN')}})
    if(!r.ok)return new Response('no pude leer el pago',{status:500})
    const pay=await r.json()
    if(pay.status!=='approved')return new Response('no aprobado',{status:200})
    const[uid,plan,code]=String(pay.external_reference??'').split('|')
    const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    let esperado=PRECIOS[plan]
    let cup:any=null
    if(code){
      const{data:c}=await sb.from('cupones').select('precio,usos,plan').eq('codigo',code).maybeSingle()
      if(c&&(!c.plan||c.plan===plan)){cup=c;esperado=Math.min(c.precio,esperado)}
    }
    if(!uid||!PRECIOS[plan]||Number(pay.transaction_amount)!==esperado||pay.currency_id!=='CLP')return new Response('datos no coinciden',{status:200})
    const ins=await sb.from('pagos').insert({mp_payment_id:dataId,user_id:uid,plan,monto:pay.transaction_amount})
    if(ins.error)return new Response('ya procesado',{status:200})   // idempotencia
    if(cup)await sb.from('cupones').update({usos:cup.usos+1}).eq('codigo',code)
    const{data:a}=await sb.from('accesos').select('plan,hasta').eq('user_id',uid).maybeSingle()
    if(plan==='lifetime'){
      await sb.from('accesos').upsert({user_id:uid,plan:'lifetime',hasta:null})
    }else if(a&&!a.hasta){
      // ya tiene acceso sin vencimiento: no se baja de plan
    }else{
      const base=a?.hasta&&new Date(a.hasta)>new Date()?new Date(a.hasta):new Date()
      base.setDate(base.getDate()+(plan==='cinco'?1825:365))
      await sb.from('accesos').upsert({user_id:uid,plan:plan==='cinco'?'cinco':(a?.plan==='cinco'?'cinco':'anual'),hasta:base.toISOString()})
    }
    return new Response('ok',{status:200})
  }catch(e){return new Response(String(e),{status:500})}
})
