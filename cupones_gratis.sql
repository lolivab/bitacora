-- Cupón 100% de un solo uso. Pegar completo en Supabase > SQL Editor y Run.
alter table public.cupones drop constraint if exists cupones_precio_check;
alter table public.cupones add constraint cupones_precio_check check (precio >= 0);
insert into public.cupones(codigo,precio,usos_max) values ('LIBRE-WE5PR4',0,1)
on conflict (codigo) do nothing;
