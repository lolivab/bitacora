PAGOS CON MERCADO PAGO - pasos de instalación (una sola vez)

1. Supabase > SQL Editor: ejecutar accesos.sql completo.
   (Usuarios actuales quedan "indefinido"; nuevos tienen 5 días de prueba.)

2. Mercado Pago > Tus integraciones > crear aplicación (Checkout Pro). Copiar:
   - Access Token de PRODUCCIÓN (o de prueba para probar)
   - Clave secreta del webhook (en Webhooks, evento "Pagos")

3. Instalar Supabase CLI y, en esta carpeta:
   supabase login
   supabase link --project-ref utcfqzzcvjaohcwbadwd
   supabase secrets set MP_ACCESS_TOKEN=... MP_WEBHOOK_SECRET=... APP_URL=https://lolivab.github.io/bitacora/
   supabase functions deploy crear-pago
   supabase functions deploy mp-webhook --no-verify-jwt

4. Mercado Pago > Webhooks: URL https://utcfqzzcvjaohcwbadwd.supabase.co/functions/v1/mp-webhook , evento "Pagos".

5. Probar con usuarios y tarjetas de prueba antes de usar credenciales de producción.

Mientras no se ejecute accesos.sql la bitácora funciona normal (no bloquea a nadie).

CÁMARAS DE WINDY (proxy)
   supabase functions deploy camaras
   (usa la clave windy_key guardada en la tabla app_config; no requiere secrets nuevos)
