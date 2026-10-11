-- Mokewa Hub · tercera migración (FORMULA-GANADORA.md, brechas I3 y O6):
-- - El cupo de cada torneo se respeta: quien llega con el cupo lleno queda en LISTA DE ESPERA y no paga
--   hasta que el club le confirme un lugar.
-- - Academia: alumnos y mensualidades, para saber quién pagó el mes, a quién recordarle y quién se fue
--   (y por qué). Solo el administrador ve estos datos.

-- ---------------------------------------------------------------- cupo y lista de espera
alter table inscripciones add column if not exists en_espera boolean not null default false;

-- «40», «40 jugadores», «Cupo: 32» → 40, 40, 32. Sin número → null (sin límite).
create or replace function cupo_de(cupo text) returns int
language sql immutable set search_path = public as $$
  select nullif(substring(coalesce(cupo, '') from '\d+'), '')::int
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
  v_cupo int;
  v_espera boolean := false;
  v_tel text := regexp_replace(coalesce(p->>'tutor_telefono', ''), '\s', '', 'g');
  v_correo text := trim(coalesce(p->>'tutor_correo', ''));
  texto_ok constant text := '^.{1,80}$';
begin
  -- «for update»: dos inscripciones al mismo tiempo no pueden quedarse con el último lugar.
  select * into t from torneos where id = p->>'torneo_id' and estado in ('publicado', 'en curso') for update;
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
  if not exists (select 1 from tutores where jugador_id = v_jug and telefono = v_tel) then
    insert into tutores (jugador_id, nombre, telefono, correo, consentimiento)
    values (v_jug, trim(p->>'tutor_nombre'), v_tel, v_correo, true);
  else
    update tutores set consentimiento_fecha = now() where jugador_id = v_jug and telefono = v_tel;
  end if;

  -- El torneo de verano tiene su costo y su cupo en «Datos del club»; los demás, en su ficha.
  v_costo := coalesce(t.costo, case when t.id = 'verano-2027' then (select valor from contenido where campo = 'verano_costo') end);
  v_cupo := cupo_de(coalesce(t.cupo, case when t.id = 'verano-2027' then (select valor from contenido where campo = 'verano_cupo') end));
  if v_cupo is not null then
    v_espera := (select count(*) from inscripciones where torneo_id = t.id and estado_pago <> 'rechazado' and not en_espera) >= v_cupo;
  end if;

  insert into inscripciones (torneo_id, jugador_id, categoria, nivel, club, monto, en_espera)
  values (t.id, v_jug, v_cat, nullif(p->>'nivel', ''), nullif(trim(coalesce(p->>'club', '')), ''), monto_de(v_costo), v_espera)
  returning * into v_ins;
  return jsonb_build_object('id', v_ins.id, 'token', v_ins.token, 'categoria', v_cat, 'creado_en', v_ins.creado_en, 'en_espera', v_espera);
end
$$;
revoke all on function inscribir(jsonb) from public, anon, authenticated;
grant execute on function inscribir(jsonb) to anon, authenticated;

-- Quien se inscribió ve también si está en lista de espera.
drop function if exists estado_inscripciones(jsonb);
create function estado_inscripciones(p jsonb) returns table (id uuid, estado_pago text, motivo text, en_espera boolean)
language sql stable security definer set search_path = public as $$
  select i.id, i.estado_pago, i.motivo, i.en_espera
  from inscripciones i
  join jsonb_to_recordset(p) as x(id uuid, token uuid) on x.id = i.id and x.token = i.token
$$;
revoke all on function estado_inscripciones(jsonb) from public, anon, authenticated;
grant execute on function estado_inscripciones(jsonb) to anon, authenticated;

-- La lista pública separa a los inscritos de la lista de espera (sigue mostrando solo nombre, categoría y club).
create or replace view inscritos_publicos with (security_invoker = false) as
  select i.torneo_id, j.nombres || ' ' || j.apellidos as nombre, i.categoria, coalesce(i.club, '—') as club,
         i.estado_pago = 'validado' as validado, i.creado_en, i.en_espera
  from inscripciones i join jugadores j on j.id = i.jugador_id
  where i.estado_pago <> 'rechazado';
revoke all on inscritos_publicos from public, anon, authenticated;
grant select on inscritos_publicos to anon, authenticated;

-- ---------------------------------------------------------------- academia: alumnos y mensualidades
create table if not exists alumnos (
  id uuid primary key default gen_random_uuid(),
  nombres text not null check (length(trim(nombres)) between 1 and 80),
  apellidos text not null check (length(trim(apellidos)) between 1 and 80),
  nivel text check (nivel in ('Básico', 'Intermedio', 'Avanzado')),
  tutor_nombre text check (length(tutor_nombre) <= 80),
  tutor_telefono text check (tutor_telefono ~ '^9\d{8}$'),
  mensualidad numeric(8, 2) check (mensualidad >= 0), -- lo acordado con la familia (puede haber becas)
  inicio date not null default current_date,
  baja date,                                          -- vacío = alumno activo
  motivo_baja text check (length(motivo_baja) <= 120),
  consentimiento_fecha timestamptz not null default now(),
  creado_en timestamptz not null default now()
);
alter table alumnos enable row level security;
create policy "solo admin ve alumnos" on alumnos for all using (rol_actual() = 'admin') with check (rol_actual() = 'admin');

create table if not exists pagos_mensuales (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references alumnos on delete cascade,
  mes date not null check (extract(day from mes) = 1), -- primer día del mes pagado
  monto numeric(8, 2) check (monto >= 0),               -- vacío si el club aún no cargó el precio
  medio text check (medio in ('Yape', 'Plin', 'Efectivo', 'Transferencia', 'Otro')),
  pagado_en date not null default current_date,
  registrado_por uuid references perfiles on delete set null,
  unique (alumno_id, mes)
);
alter table pagos_mensuales enable row level security;
create policy "solo admin ve pagos mensuales" on pagos_mensuales for all using (rol_actual() = 'admin') with check (rol_actual() = 'admin');
create index if not exists pagos_mensuales_mes on pagos_mensuales (mes);
