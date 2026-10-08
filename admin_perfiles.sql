-- Permite que el administrador (jolivab@gmail.com) LEA los perfiles (fechas de habilitaciones) de todos los usuarios.
-- Solo lectura. Requiere haber ejecutado migracion_v4.sql. Seguro de ejecutar más de una vez.
drop policy if exists "admin lee perfiles" on public.perfiles;
create policy "admin lee perfiles" on public.perfiles
  for select
  using (coalesce(auth.jwt() ->> 'email','') = 'jolivab@gmail.com');
