-- Acceso / suscripciones. Ejecutar completo en Supabase > SQL Editor.
create table if not exists public.accesos(
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'prueba' check (plan in ('prueba','anual','lifetime','indefinido')),
  hasta timestamptz,            -- null = sin vencimiento
  creado timestamptz not null default now()
);
create table if not exists public.pagos(
  mp_payment_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null,
  monto numeric not null,
  creado timestamptz not null default now()
);
alter table public.accesos enable row level security;
alter table public.pagos enable row level security;
drop policy if exists "ver mi acceso" on public.accesos;
create policy "ver mi acceso" on public.accesos for select to authenticated using (user_id = auth.uid());
-- (pagos: sin políticas; solo accede el servicio)

-- Usuarios actuales: Lifetime (sin vencimiento)
insert into public.accesos(user_id,plan,hasta)
select id,'lifetime',null from auth.users
on conflict (user_id) do nothing;

-- Usuarios nuevos: 5 días de prueba
create or replace function public.nuevo_acceso() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.accesos(user_id,plan,hasta) values (new.id,'prueba',now()+interval '5 days')
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists trg_nuevo_acceso on auth.users;
create trigger trg_nuevo_acceso after insert on auth.users for each row execute function public.nuevo_acceso();
