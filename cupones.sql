-- Cupones de descuento. Ejecutar completo en Supabase > SQL Editor.
create table if not exists public.cupones(
  codigo text primary key,          -- en MAYÚSCULAS
  precio integer not null check (precio >= 0),   -- precio final en CLP, para cualquier plan
  usos_max integer,                 -- null = ilimitado
  usos integer not null default 0,
  activo boolean not null default true
);
alter table public.cupones enable row level security;   -- sin políticas: solo accede el servicio

insert into public.cupones(codigo,precio,usos_max) values ('VUELO500',500,20)
on conflict (codigo) do nothing;
-- Para desactivarlo:  update public.cupones set activo=false where codigo='VUELO500';
-- Para crear otro:    insert into public.cupones(codigo,precio,usos_max) values ('OTRO',990,5);

-- Cupón 100% de un solo uso (acceso gratis, sin pasar por Mercado Pago)
insert into public.cupones(codigo,precio,usos_max) values ('VUELO100',0,1)
on conflict (codigo) do nothing;
