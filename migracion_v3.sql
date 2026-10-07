-- Métricas: guarda Capitán, Copiloto y Jefe de cabina de cada vuelo.
-- Pegar completo en Supabase > SQL Editor y presionar Run. Es seguro ejecutarlo más de una vez.
alter table public.vuelos add column if not exists capitan text;
alter table public.vuelos add column if not exists copiloto text;
alter table public.vuelos add column if not exists jefe_cabina text;
