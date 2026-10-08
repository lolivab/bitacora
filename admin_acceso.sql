-- Último acceso: registra cada vez que un usuario abre la bitácora (no solo cuando inicia sesión con clave).
-- Pegar completo en Supabase > SQL Editor y presionar Run. Seguro de ejecutar más de una vez.
-- Requiere haber ejecutado migracion_v4.sql / perfil.sql (tabla perfiles).

alter table public.perfiles add column if not exists ultimo_acceso timestamptz;

drop function if exists public.admin_resumen();
create or replace function public.admin_resumen()
returns table (
  user_id uuid, nombre text, email text, registrado timestamptz,
  vuelos bigint, horas double precision, ultimo_vuelo date, ultimo_login timestamptz, ultimo_acceso timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if coalesce(auth.jwt() ->> 'email','') <> 'jolivab@gmail.com' then
    raise exception 'No autorizado';
  end if;
  return query
    select u.id,
           coalesce(u.raw_user_meta_data ->> 'nombre', '')::text,
           u.email::text,
           u.created_at,
           count(v.id),
           coalesce(sum(v.total), 0)::double precision,
           max(v.fecha),
           u.last_sign_in_at,
           max(p.ultimo_acceso)
    from auth.users u
    left join public.vuelos v on v.user_id = u.id
    left join public.perfiles p on p.user_id = u.id
    group by u.id, u.raw_user_meta_data, u.email, u.created_at, u.last_sign_in_at
    order by 6 desc;
end;
$$;

revoke all on function public.admin_resumen() from public, anon;
grant execute on function public.admin_resumen() to authenticated;
