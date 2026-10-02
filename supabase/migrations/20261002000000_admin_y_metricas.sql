-- Mokewa Hub · segunda migración: primer administrador, jugadores sin duplicados, monto de cada
-- inscripción y conteo anónimo de visitas. Se aplica después de 20260930000000_mokewa.sql.
--
-- Para qué sirve cada parte:
-- - Primer administrador: el dueño entra al panel con su cuenta y se activa como admin con un botón,
--   sin escribir SQL. Solo funciona mientras no haya ningún admin y solo para la cuenta más antigua.
-- - Jugadores sin duplicados: el mismo niño inscrito en dos torneos es UN jugador. Así el panel sabe
--   cuántos vuelven (retención), y nadie queda inscrito dos veces en el mismo torneo.
-- - Monto: cada inscripción guarda lo que costaba al inscribirse, para sumar ingresos y deudas.
-- - Visitas: totales por día, página y evento. Sin cookies, sin IP, sin identificar a nadie.

-- ---------------------------------------------------------------- primer administrador
create or replace function hay_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where rol = 'admin')
$$;

-- La cuenta más antigua de Authentication es la del dueño (README: se crea primero). Si alguien dejara el
-- registro público abierto por error, una cuenta creada después no podría quedarse con el panel.
create or replace function reclamar_admin(p_nombre text) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'sin_sesion' using errcode = 'P0001'; end if;
  if trim(coalesce(p_nombre, '')) !~ '^.{1,80}$' then raise exception 'datos_incompletos' using errcode = 'P0001'; end if;
  lock table perfiles in share row exclusive mode; -- dos intentos a la vez: solo uno gana
  if exists (select 1 from perfiles where rol = 'admin') then raise exception 'ya_hay_admin' using errcode = 'P0001'; end if;
  if auth.uid() is distinct from (select id from auth.users order by created_at, id limit 1) then
    raise exception 'no_es_primera_cuenta' using errcode = 'P0001';
  end if;
  insert into perfiles (id, nombre, rol) values (auth.uid(), trim(p_nombre), 'admin')
  on conflict (id) do update set nombre = excluded.nombre, rol = 'admin';
end
$$;
revoke all on function hay_admin() from public, anon, authenticated;
revoke all on function reclamar_admin(text) from public, anon, authenticated;
grant execute on function hay_admin() to authenticated;
grant execute on function reclamar_admin(text) to authenticated;

-- ---------------------------------------------------------------- jugadores sin duplicados
-- Mismo nombre, apellidos y fecha de nacimiento = mismo jugador (sin importar mayúsculas, tildes ni espacios).
create or replace function clave_nombre(t text) returns text
language sql immutable set search_path = public as $$
  select regexp_replace(translate(lower(trim(coalesce(t, ''))), 'áéíóúüàèìòù', 'aeiouuaeiou'), '\s+', ' ', 'g')
$$;
create index if not exists jugadores_identidad on jugadores (clave_nombre(nombres), clave_nombre(apellidos), fecha_nacimiento);
create unique index if not exists inscripciones_una_por_torneo on inscripciones (torneo_id, jugador_id);

-- Lo que costaba la inscripción cuando se hizo (si después cambia el precio, lo cobrado no cambia).
alter table inscripciones add column if not exists monto numeric(8, 2);

-- «S/ 15», «15 soles», «S/. 12.50» → 15, 15, 12.5. «Gratis» o «Libre» → 0. Sin número → null.
create or replace function monto_de(costo text) returns numeric
language sql immutable set search_path = public as $$
  select case
    when costo is null then null
    when costo ~* '(gratis|libre|sin costo)' then 0
    else nullif(replace(substring(costo from '\d+(?:[.,]\d{1,2})?'), ',', '.'), '')::numeric
  end
$$;

create or replace function inscribir(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t torneos;
  v_nac date;
  v_cat text;
  v_jug uuid;
  v_ins inscripciones;
  v_costo text;
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

  -- ¿Ya jugó con nosotros? Se reutiliza su ficha (no se sobrescribe nada que ya tenga).
  select id into v_jug from jugadores
  where clave_nombre(nombres) = clave_nombre(p->>'nombres')
    and clave_nombre(apellidos) = clave_nombre(p->>'apellidos')
    and fecha_nacimiento = v_nac
  order by creado_en limit 1;
  if v_jug is null then
    insert into jugadores (nombres, apellidos, fecha_nacimiento, usuario_lichess)
    values (trim(p->>'nombres'), trim(p->>'apellidos'), v_nac, nullif(trim(coalesce(p->>'lichess', '')), ''))
    returning id into v_jug;
  else
    if exists (select 1 from inscripciones where torneo_id = t.id and jugador_id = v_jug) then
      raise exception 'ya_inscrito' using errcode = 'P0001';
    end if;
    update jugadores set usuario_lichess = nullif(trim(coalesce(p->>'lichess', '')), '')
    where id = v_jug and usuario_lichess is null;
  end if;
  -- Un tutor nuevo solo si es otro celular (mamá y papá pueden inscribir en torneos distintos).
  if not exists (select 1 from tutores where jugador_id = v_jug and telefono = v_tel) then
    insert into tutores (jugador_id, nombre, telefono, correo, consentimiento)
    values (v_jug, trim(p->>'tutor_nombre'), v_tel, v_correo, true);
  else
    update tutores set consentimiento_fecha = now() where jugador_id = v_jug and telefono = v_tel;
  end if;

  -- El torneo de verano tiene su costo en «Datos del club»; los demás, en su ficha.
  v_costo := coalesce(t.costo, case when t.id = 'verano-2027' then (select valor from contenido where campo = 'verano_costo') end);
  insert into inscripciones (torneo_id, jugador_id, categoria, nivel, club, monto)
  values (t.id, v_jug, v_cat, nullif(p->>'nivel', ''), nullif(trim(coalesce(p->>'club', '')), ''), monto_de(v_costo))
  returning * into v_ins;
  return jsonb_build_object('id', v_ins.id, 'token', v_ins.token, 'categoria', v_cat, 'creado_en', v_ins.creado_en);
end
$$;
revoke all on function inscribir(jsonb) from public, anon, authenticated;
grant execute on function inscribir(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------- visitas (conteo anónimo)
-- Solo totales por día: «el 2 de octubre, /academia/ tuvo 40 vistas y 3 clics a WhatsApp».
create table if not exists visitas_diarias (
  dia date not null,
  pagina text not null,
  evento text not null,
  total int not null default 0,
  primary key (dia, pagina, evento)
);
alter table visitas_diarias enable row level security;
create policy "admin ve visitas" on visitas_diarias for select using (rol_actual() = 'admin');

create or replace function registrar_evento(p_evento text, p_pagina text) returns void
language plpgsql security definer set search_path = public as $$
declare hoy date := (now() at time zone 'America/Lima')::date;
begin
  -- Lo que no se reconoce se ignora en silencio (no hay nada que responder a quien lo envía).
  if p_evento is null or p_evento not in ('vista', 'sesion', 'whatsapp', 'correo', 'facebook', 'como_llegar', 'inscripcion_inicio') then return; end if;
  if p_pagina is null or p_pagina !~ '^/[a-z0-9/_-]{0,60}$' then return; end if;
  -- Tope de 40 páginas distintas por día: nadie puede llenar la tabla inventando direcciones.
  if not exists (select 1 from visitas_diarias where dia = hoy and pagina = p_pagina)
     and (select count(distinct pagina) from visitas_diarias where dia = hoy) >= 40 then
    return;
  end if;
  insert into visitas_diarias (dia, pagina, evento, total) values (hoy, p_pagina, p_evento, 1)
  on conflict (dia, pagina, evento) do update set total = visitas_diarias.total + 1
  where visitas_diarias.total < 1000000;
end
$$;
revoke all on function registrar_evento(text, text) from public, anon, authenticated;
grant execute on function registrar_evento(text, text) to anon, authenticated;
