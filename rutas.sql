-- Plan de ruta (NavLog): tabla de rutas guardadas por usuario (ya aplicada en Supabase).
create table if not exists public.rutas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 80),
  puntos jsonb not null check (jsonb_typeof(puntos) = 'array' and jsonb_array_length(puntos) between 2 and 20),
  avion text,
  vav numeric check (vav is null or (vav >= 30 and vav <= 600)),
  altitud integer check (altitud is null or (altitud >= 0 and altitud <= 60000)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rutas_user_id_idx on public.rutas (user_id);
alter table public.rutas enable row level security;
create policy "rutas_select_propias" on public.rutas for select to authenticated using (user_id = (select auth.uid()));
create policy "rutas_insert_propias" on public.rutas for insert to authenticated with check (user_id = (select auth.uid()));
create policy "rutas_update_propias" on public.rutas for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "rutas_delete_propias" on public.rutas for delete to authenticated using (user_id = (select auth.uid()));
