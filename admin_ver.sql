-- Permite que el administrador (jolivab@gmail.com) LEA los vuelos de todos los usuarios.
-- Solo lectura: no puede editar ni borrar vuelos ajenos. El resto de usuarios sigue viendo solo lo suyo.
-- Pegar completo en Supabase > SQL Editor y presionar Run. Es seguro ejecutarlo más de una vez.

drop policy if exists "admin lee todos los vuelos" on public.vuelos;
create policy "admin lee todos los vuelos" on public.vuelos
  for select
  using (coalesce(auth.jwt() ->> 'email','') = 'jolivab@gmail.com');
