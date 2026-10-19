-- Permite que el administrador (jolivab@gmail.com) LEA los accesos/planes de todos los usuarios. Solo lectura.
-- Pegar completo en Supabase > SQL Editor y presionar Run. Seguro de ejecutar más de una vez.
drop policy if exists "admin lee accesos" on public.accesos;
create policy "admin lee accesos" on public.accesos
  for select
  using (coalesce(auth.jwt() ->> 'email','') = 'jolivab@gmail.com');
