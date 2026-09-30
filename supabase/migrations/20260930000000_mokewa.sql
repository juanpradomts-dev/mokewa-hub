-- Mokewa Hub · base de datos de la web oficial (Supabase / Postgres). Sección 8 de la guía.
--
-- Principios:
-- - Toda tabla con datos personales tiene Row Level Security (RLS).
-- - Roles: admin (todo), entrenador (torneos, resultados, noticias), público (solo lo publicado).
-- - El público nunca escribe directo en las tablas: la inscripción entra por la función
--   inscribir(), que valida en el servidor y calcula la categoría.
-- - Listas públicas: solo nombre, categoría y club (sección 9.2). Comprobantes en un bucket
--   privado, que solo el admin ve con enlaces firmados.
--
-- Se aplica con la CLI («supabase db push») o pegándolo una vez en el SQL Editor de Supabase.

-- ---------------------------------------------------------------- personal del club
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

-- Gestión del personal desde el panel (solo el admin). Las cuentas se crean en Supabase → Authentication;
-- aquí se les da un rol, se cambia o se quita. Siempre queda al menos un admin.
create or replace function personal() returns table (nombre text, rol text, correo text)
language sql stable security definer set search_path = public, auth as $$
  select p.nombre, p.rol, u.email::text from perfiles p join auth.users u on u.id = p.id
  where rol_actual() = 'admin'
  order by p.rol, p.nombre
$$;

create or replace function dar_acceso(p_correo text, p_nombre text, p_rol text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid; rol_previo text;
begin
  if rol_actual() is distinct from 'admin' then raise exception 'solo_admin' using errcode = 'P0001'; end if;
  if p_rol not in ('admin', 'entrenador') then raise exception 'rol_invalido' using errcode = 'P0001'; end if;
  if trim(coalesce(p_nombre, '')) !~ '^.{1,80}$' then raise exception 'datos_incompletos' using errcode = 'P0001'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_correo));
  if uid is null then raise exception 'cuenta_no_existe' using errcode = 'P0001'; end if;
  select rol into rol_previo from perfiles where id = uid;
  if rol_previo = 'admin' and p_rol <> 'admin' and (select count(*) from perfiles where rol = 'admin') = 1 then
    raise exception 'ultimo_admin' using errcode = 'P0001';
  end if;
  insert into perfiles (id, nombre, rol) values (uid, trim(p_nombre), p_rol)
  on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol;
end
$$;

create or replace function quitar_acceso(p_correo text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  if rol_actual() is distinct from 'admin' then raise exception 'solo_admin' using errcode = 'P0001'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_correo));
  if uid = auth.uid() then raise exception 'a_ti_mismo' using errcode = 'P0001'; end if;
  if (select rol from perfiles where id = uid) = 'admin' and (select count(*) from perfiles where rol = 'admin') = 1 then
    raise exception 'ultimo_admin' using errcode = 'P0001';
  end if;
  delete from perfiles where id = uid;
end
$$;
revoke all on function personal() from public, anon, authenticated;
revoke all on function dar_acceso(text, text, text) from public, anon, authenticated;
revoke all on function quitar_acceso(text) from public, anon, authenticated;
grant execute on function personal() to authenticated;
grant execute on function dar_acceso(text, text, text) to authenticated;
grant execute on function quitar_acceso(text) to authenticated;

-- ---------------------------------------------------------------- categorías (igual que src/lib/categorias.js)
-- Edad al 1 de enero del año del torneo; la primera Sub-N con edad < N, o «Libre».
create or replace function categoria_para(nac date, anio int, cats text[]) returns text
language sql immutable set search_path = public as $$
  with e as (
    select anio - extract(year from nac)::int
           - case when extract(month from nac) = 1 and extract(day from nac) = 1 then 0 else 1 end as edad
  ),
  subs as (
    select c, (regexp_match(c, 'sub-?(\d+)', 'i'))[1]::int as n from unnest(cats) as c
  )
  select case
    when (select edad from e) < 3 or (select edad from e) > 100 then null
    else coalesce(
      (select subs.c from subs, e where subs.n is not null and e.edad < subs.n order by subs.n limit 1),
      case when 'Libre' = any(cats) then 'Libre' end)
  end
$$;

-- ---------------------------------------------------------------- torneos (públicos cuando están publicados)
-- El id es texto: «verano-2027» para el torneo fijo de la web y un uuid para los creados en el panel.
create table if not exists torneos (
  id text primary key default gen_random_uuid()::text,
  nombre text not null,
  modalidad text not null default 'Presencial' check (modalidad in ('Presencial', 'Online', 'Híbrido')),
  anio int,
  fecha_inicio date,
  ritmo text,
  sede text,
  cupo text,
  costo text,
  categorias text[] not null default array['Sub-8', 'Sub-10', 'Sub-12', 'Sub-14', 'Sub-16', 'Sub-18', 'Libre'],
  bases_url text,
  foto_url text,
  descripcion text,
  estado text not null default 'publicado' check (estado in ('borrador', 'publicado', 'en curso', 'finalizado')),
  creado_en timestamptz not null default now()
);
alter table torneos enable row level security;
create policy "público ve torneos publicados" on torneos for select using (estado <> 'borrador' or rol_actual() is not null);
create policy "personal gestiona torneos" on torneos for all using (rol_actual() in ('admin', 'entrenador')) with check (rol_actual() in ('admin', 'entrenador'));

-- El torneo de la página /torneos/verano-2027/. La web solo lo muestra si el club confirma la fecha.
insert into torneos (id, nombre, modalidad, anio) values ('verano-2027', 'Torneo de Verano 2027', 'Presencial', 2027)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- jugadores y tutores (privados)
create table if not exists jugadores (
  id uuid primary key default gen_random_uuid(),
  nombres text not null,
  apellidos text not null,
  fecha_nacimiento date not null,          -- la categoría se calcula, no se guarda aquí
  usuario_lichess text,
  fide_id text,
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

-- ---------------------------------------------------------------- inscripciones
create table if not exists inscripciones (
  id uuid primary key default gen_random_uuid(),
  torneo_id text not null references torneos on delete cascade,
  jugador_id uuid not null references jugadores on delete cascade,
  categoria text not null,
  nivel text check (nivel in ('Básico', 'Intermedio', 'Avanzado')),
  club text,
  estado_pago text not null default 'pendiente' check (estado_pago in ('pendiente', 'validado', 'rechazado')),
  motivo text,
  voucher_url text,                          -- ruta en el bucket privado «vouchers»
  token uuid not null default gen_random_uuid(), -- solo lo conoce quien se inscribió: consulta su estado
  validado_por uuid references perfiles on delete set null,
  validado_en timestamptz,
  creado_en timestamptz not null default now()
);
alter table inscripciones enable row level security;
create policy "admin gestiona inscripciones" on inscripciones for all using (rol_actual() = 'admin') with check (rol_actual() = 'admin');
create index if not exists inscripciones_torneo on inscripciones (torneo_id);

-- Inscripción pública: valida todo en el servidor y devuelve el id y el token de consulta.
create or replace function inscribir(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t torneos;
  v_nac date;
  v_cat text;
  v_jug uuid;
  v_ins inscripciones;
  v_tel text := regexp_replace(coalesce(p->>'tutor_telefono', ''), '\s', '', 'g');
  v_correo text := trim(coalesce(p->>'tutor_correo', ''));
  texto_ok constant text := '^.{1,80}$';
begin
  select * into t from torneos where id = p->>'torneo_id' and estado in ('publicado', 'en curso');
  if not found then raise exception 'torneo_no_disponible' using errcode = 'P0001'; end if;
  if coalesce((p->>'consentimiento')::boolean, false) is not true then raise exception 'falta_consentimiento' using errcode = 'P0001'; end if;
  if trim(coalesce(p->>'nombres', '')) !~ texto_ok or trim(coalesce(p->>'apellidos', '')) !~ texto_ok
     or trim(coalesce(p->>'tutor_nombre', '')) !~ texto_ok then
    raise exception 'datos_incompletos' using errcode = 'P0001';
  end if;
  if length(coalesce(p->>'club', '')) > 80 or length(coalesce(p->>'lichess', '')) > 40 then raise exception 'datos_largos' using errcode = 'P0001'; end if;
  if v_tel !~ '^9\d{8}$' then raise exception 'telefono_invalido' using errcode = 'P0001'; end if;
  if v_correo !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_correo) > 120 then raise exception 'correo_invalido' using errcode = 'P0001'; end if;
  begin
    v_nac := (p->>'fecha_nacimiento')::date;
  exception when others then
    raise exception 'fecha_invalida' using errcode = 'P0001';
  end;
  v_cat := categoria_para(v_nac, coalesce(t.anio, extract(year from t.fecha_inicio)::int, extract(year from now())::int + 1), t.categorias);
  if v_cat is null then raise exception 'sin_categoria' using errcode = 'P0001'; end if;

  insert into jugadores (nombres, apellidos, fecha_nacimiento, usuario_lichess)
  values (trim(p->>'nombres'), trim(p->>'apellidos'), v_nac, nullif(trim(coalesce(p->>'lichess', '')), ''))
  returning id into v_jug;
  insert into tutores (jugador_id, nombre, telefono, correo, consentimiento)
  values (v_jug, trim(p->>'tutor_nombre'), v_tel, v_correo, true);
  insert into inscripciones (torneo_id, jugador_id, categoria, nivel, club)
  values (t.id, v_jug, v_cat, nullif(p->>'nivel', ''), nullif(trim(coalesce(p->>'club', '')), ''))
  returning * into v_ins;
  return jsonb_build_object('id', v_ins.id, 'token', v_ins.token, 'categoria', v_cat, 'creado_en', v_ins.creado_en);
end
$$;
revoke all on function inscribir(jsonb) from public, anon, authenticated;
grant execute on function inscribir(jsonb) to anon, authenticated;

-- Quien se inscribió consulta el estado de SUS inscripciones (id + token guardados en su navegador).
create or replace function estado_inscripciones(p jsonb) returns table (id uuid, estado_pago text, motivo text)
language sql stable security definer set search_path = public as $$
  select i.id, i.estado_pago, i.motivo
  from inscripciones i
  join jsonb_to_recordset(p) as x(id uuid, token uuid) on x.id = i.id and x.token = i.token
$$;
revoke all on function estado_inscripciones(jsonb) from public, anon, authenticated;
grant execute on function estado_inscripciones(jsonb) to anon, authenticated;

-- Lista pública: solo nombre, categoría y club (sección 9.2).
create or replace view inscritos_publicos with (security_invoker = false) as
  select i.torneo_id, j.nombres || ' ' || j.apellidos as nombre, i.categoria, coalesce(i.club, '—') as club,
         i.estado_pago = 'validado' as validado, i.creado_en
  from inscripciones i join jugadores j on j.id = i.jugador_id
  where i.estado_pago <> 'rechazado';
-- Solo lectura: se revocan los permisos que Supabase da por defecto (insertar, actualizar, borrar).
revoke all on inscritos_publicos from public, anon, authenticated;
grant select on inscritos_publicos to anon, authenticated;

-- ---------------------------------------------------------------- comprobantes: bucket privado
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vouchers', 'vouchers', false, 5242880, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Se puede subir UN comprobante por inscripción, en «inscripciones/<id>», durante la primera hora.
create or replace function puede_subir_voucher(nombre text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from inscripciones i
    where nombre = 'inscripciones/' || i.id::text
      and i.voucher_url is null
      and i.creado_en > now() - interval '1 hour')
$$;
create policy "formulario sube su comprobante" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'vouchers' and puede_subir_voucher(name));
create policy "admin ve comprobantes" on storage.objects for select using (bucket_id = 'vouchers' and rol_actual() = 'admin');
create policy "admin borra comprobantes" on storage.objects for delete using (bucket_id = 'vouchers' and rol_actual() = 'admin');

-- Tras subirlo, el formulario lo registra con su token.
create or replace function registrar_voucher(p_id uuid, p_token uuid) returns boolean
language plpgsql security definer set search_path = public, storage as $$
declare n int;
begin
  update inscripciones set voucher_url = 'inscripciones/' || id::text
  where id = p_id and token = p_token and voucher_url is null
    and exists (select 1 from storage.objects o where o.bucket_id = 'vouchers' and o.name = 'inscripciones/' || p_id::text);
  get diagnostics n = row_count;
  return n = 1;
end
$$;
revoke all on function registrar_voucher(uuid, uuid) from public, anon, authenticated;
grant execute on function registrar_voucher(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------- noticias y resultados publicados
create table if not exists noticias (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  cuerpo text not null,
  fecha_publicacion date not null default current_date,
  autor_id uuid references perfiles on delete set null
);
alter table noticias enable row level security;
create policy "público ve noticias" on noticias for select using (true);
create policy "personal gestiona noticias" on noticias for all using (rol_actual() in ('admin', 'entrenador')) with check (rol_actual() in ('admin', 'entrenador'));

-- Resultados tal como los publica el panel (desde Lichess o un CSV de Swiss-Manager).
create table if not exists resultados_publicados (
  clave text primary key,
  nombre text not null,
  origen text,
  filas jsonb not null default '[]',
  cronica text,
  publicado_en timestamptz not null default now()
);
alter table resultados_publicados enable row level security;
create policy "público ve resultados" on resultados_publicados for select using (true);
create policy "personal gestiona resultados" on resultados_publicados for all using (rol_actual() in ('admin', 'entrenador')) with check (rol_actual() in ('admin', 'entrenador'));

-- ---------------------------------------------------------------- datos del club editables (src/data/contenido.json)
create table if not exists contenido (
  campo text primary key,
  valor text,
  actualizado_en timestamptz not null default now()
);
alter table contenido enable row level security;
create policy "público lee contenido" on contenido for select using (true);
create policy "admin edita contenido" on contenido for all using (rol_actual() = 'admin') with check (rol_actual() = 'admin');
