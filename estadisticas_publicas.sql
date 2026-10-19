-- Estadísticas públicas para la pantalla de entrada (solo totales agregados, sin datos de usuarios).
-- Pegar completo en Supabase > SQL Editor y presionar Run. Seguro de ejecutar más de una vez.
create or replace function public.estadisticas_publicas()
returns json
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select ruta, total, tipo, coalesce(previo,false) as previo from public.vuelos
  ),
  rutas as (
    select string_to_array(regexp_replace(trim(ruta), '\s+', ' ', 'g'), ' ') as c
    from base
    where not previo and tipo <> 'Simulador' and ruta is not null and trim(ruta) <> ''
  ),
  legs as (
    select upper(r.c[i]) as a, upper(r.c[i+1]) as b, count(*) as n
    from rutas r
    cross join lateral generate_series(1, coalesce(array_length(r.c,1),1) - 1) as i
    where r.c[i] ~ '^[A-Za-z0-9]{3,4}$' and r.c[i+1] ~ '^[A-Za-z0-9]{3,4}$'
      and upper(r.c[i]) <> upper(r.c[i+1])
    group by 1, 2
  ),
  ult as (
    select upper(c[1]) as o, upper(c[array_length(c,1)]) as d, total, modelo
    from (
      select string_to_array(regexp_replace(trim(ruta), '\s+', ' ', 'g'), ' ') as c, total, modelo, fecha
      from public.vuelos
      where not coalesce(previo,false) and tipo <> 'Simulador' and ruta is not null and trim(ruta) <> ''
      order by fecha desc, id desc limit 1
    ) q
  )
  select json_build_object(
    'ultimo', (select json_build_object('o',o,'d',d,'t',total,'m',modelo) from ult),
    'vuelos', (select count(*) from base where not previo and tipo <> 'Simulador'),
    'horas',  (select coalesce(sum(total),0) from base where tipo <> 'Simulador'),
    'tramos', (select coalesce(json_agg(json_build_object('a',a,'b',b,'n',n)), '[]'::json) from legs)
  );
$$;
revoke all on function public.estadisticas_publicas() from public;
grant execute on function public.estadisticas_publicas() to anon, authenticated;
