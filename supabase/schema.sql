-- Mokewa Hub · esquema para producción en Supabase (Postgres).
-- Sección 8 de la guía. Toda tabla con datos personales tiene Row Level Security.
-- Roles: admin (todo), entrenador (torneos, resultados, academia), público (solo lo publicado).
-- Se ejecuta una vez en el SQL Editor de Supabase. La web de la demo usa src/lib/store.js
-- (navegador); en producción cada función de store.js se reemplaza por consultas a estas tablas.

-- ---------------------------------------------------------------- roles del personal
create table if not exists perfiles (
  id uuid primary key references auth.users on delete cascade,
  nombre text not null,
  rol text not null check (rol in ('admin', 'entrenador')),
  creado_en timestamptz not null default now()
);
alter table perfiles enable row level security;

create or replace function rol_actual() returns text
language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid()
$$;

create policy "personal ve su perfil" on perfiles for select using (id = auth.uid() or rol_actual() = 'admin');
create policy "admin gestiona perfiles" on perfiles for all using (rol_actual() = 'admin') with check (rol_actual() = 'admin');

-- ---------------------------------------------------------------- jugadores y tutores (privado)
create table if not exists jugadores (
  id uuid primary key default gen_random_uuid(),
  nombres text not null,
  apellidos text not null,
  fecha_nacimiento date not null,          -- la categoría se calcula, no se guarda
  usuario_lichess text,
  fide_id text,
  rating_fide int,
  rating_fide_fecha date,
  nivel_academia text check (nivel_academia in ('Básico', 'Intermedio', 'Avanzado')),
  foto_url text,                            -- solo con autorización escrita del tutor
  creado_en timestamptz not null default now()
);
alter table jugadores enable row level security;
create policy "personal lee jugadores" on jugadores for select using (rol_actual() in ('admin', 'entrenador'));
create policy "admin gestiona jugadores" on jugadores for all using (rol_actual() = 'admin') with check (rol_actual() = 'admin');

create table if not exists tutores (
  id uuid primary key default gen_random_uuid(),
  jugador_id uuid not null references jugadores on delete cascade,
  nombre text not null,
  telefono text not null,
  correo text not null,
  consentimiento boolean not null check (consentimiento),
  consentimiento_fecha timestamptz not null default now()
);
alter table tutores enable row level security;
create policy "solo admin ve tutores" on tutores for all using (rol_actual() = 'admin') with check (rol_actual() = 'admin');

-- ---------------------------------------------------------------- torneos (público cuando está publicado)
create table if not exists torneos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  modalidad text not null check (modalidad in ('Presencial', 'Online', 'Híbrido')),
  ritmo text,
  fecha_inicio date,
  sede text,
  categorias text[] not null default '{}',
  cupo int,
  costo text,
  bases_url text,
  lichess_id text,
  estado text not null default 'borrador' check (estado in ('borrador', 'publicado', 'en curso', 'finalizado')),
  creado_en timestamptz not null default now()
);
alter table torneos enable row level security;
create policy "público ve torneos publicados" on torneos for select using (estado <> 'borrador' or rol_actual() is not null);
create policy "personal gestiona torneos" on torneos for all using (rol_actual() in ('admin', 'entrenador')) with check (rol_actual() in ('admin', 'entrenador'));

-- ---------------------------------------------------------------- inscripciones
create table if not exists inscripciones (
  id uuid primary key default gen_random_uuid(),
  torneo_id uuid not null references torneos on delete cascade,
  jugador_id uuid not null references jugadores on delete cascade,
  categoria text not null,
  club text,
  estado_pago text not null default 'pendiente' check (estado_pago in ('pendiente', 'validado', 'rechazado')),
  motivo text,
  voucher_url text,                          -- ruta en el bucket privado "vouchers"
  validado_por uuid references perfiles,
  creado_en timestamptz not null default now()
);
alter table inscripciones enable row level security;
create policy "admin gestiona inscripciones" on inscripciones for all using (rol_actual() = 'admin') with check (rol_actual() = 'admin');
-- El formulario público inserta por una función del servidor (clave de servicio), nunca directo.

-- Lista pública: solo nombre, categoría y club (sección 9.2).
create or replace view inscritos_publicos with (security_invoker = false) as
  select i.torneo_id, j.nombres || ' ' || j.apellidos as nombre, i.categoria, coalesce(i.club, '—') as club,
         i.estado_pago = 'validado' as validado
  from inscripciones i join jugadores j on j.id = i.jugador_id
  where i.estado_pago <> 'rechazado';
grant select on inscritos_publicos to anon, authenticated;

-- ---------------------------------------------------------------- resultados, logros, noticias
create table if not exists resultados (
  id uuid primary key default gen_random_uuid(),
  torneo_id uuid not null references torneos on delete cascade,
  jugador_id uuid references jugadores on delete set null,
  nombre_publico text not null,
  categoria text,
  puesto int not null,
  puntos numeric,
  desempate_1 numeric,
  desempate_2 numeric
);
alter table resultados enable row level security;
create policy "público ve resultados" on resultados for select using (true);
create policy "personal gestiona resultados" on resultados for all using (rol_actual() in ('admin', 'entrenador')) with check (rol_actual() in ('admin', 'entrenador'));

create table if not exists logros (
  id uuid primary key default gen_random_uuid(),
  jugador_id uuid not null references jugadores on delete cascade,
  descripcion text not null,
  fecha date,
  evidencia_url text
);
alter table logros enable row level security;
create policy "personal gestiona logros" on logros for all using (rol_actual() in ('admin', 'entrenador')) with check (rol_actual() in ('admin', 'entrenador'));

create table if not exists noticias (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  cuerpo text not null,
  fecha_publicacion date not null default current_date,
  imagenes text[] not null default '{}',
  autor_id uuid references perfiles
);
alter table noticias enable row level security;
create policy "público ve noticias" on noticias for select using (true);
create policy "personal gestiona noticias" on noticias for all using (rol_actual() in ('admin', 'entrenador')) with check (rol_actual() in ('admin', 'entrenador'));

-- ---------------------------------------------------------------- contenido editable y caché de Lichess
create table if not exists contenido (
  campo text primary key,                    -- whatsapp, sede, precio_mensual… (src/data/contenido.json)
  valor text,
  actualizado_en timestamptz not null default now()
);
alter table contenido enable row level security;
create policy "público lee contenido" on contenido for select using (true);
create policy "admin edita contenido" on contenido for all using (rol_actual() = 'admin') with check (rol_actual() = 'admin');

create table if not exists cache_lichess (
  clave text primary key,
  json jsonb not null,
  actualizado_en timestamptz not null default now()
);
alter table cache_lichess enable row level security;
create policy "público lee caché" on cache_lichess for select using (true);
-- Solo la función programada (clave de servicio, en el servidor) escribe aquí.

-- ---------------------------------------------------------------- vouchers: bucket privado
insert into storage.buckets (id, name, public) values ('vouchers', 'vouchers', false) on conflict (id) do nothing;
create policy "admin lee vouchers" on storage.objects for select using (bucket_id = 'vouchers' and rol_actual() = 'admin');
-- La subida la hace la función del servidor; el admin los ve con enlaces firmados que caducan.
