// Conexión con la base de datos de la web oficial (Supabase: supabase/migrations/).
// Solo se descarga cuando la web se construye con PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY
// (ver backend.js). Devuelve los datos con la misma forma que usa store.js en la demo, así las
// páginas no cambian. En el navegador solo va la clave pública: lo privado lo protege RLS.
import { createClient } from "@supabase/supabase-js";
import { urlBaseDeDatos, clavePublica } from "./backend.js";

const sb = createClient(urlBaseDeDatos, clavePublica, {
  auth: { storageKey: "mokewa-sesion", persistSession: true, autoRefreshToken: true },
});

// Inscripciones hechas desde este navegador: id + token para consultar su estado (sin datos de otros).
const MIAS = "mokewa-mis-inscripciones";
const leerMias = () => {
  try {
    return JSON.parse(localStorage.getItem(MIAS) ?? "[]");
  } catch {
    return [];
  }
};
const guardarMias = (lista) => {
  try {
    localStorage.setItem(MIAS, JSON.stringify(lista));
  } catch {}
};

// Mensajes claros para los errores que devuelve la base de datos.
const MENSAJES = {
  torneo_no_disponible: "Este torneo ya no recibe inscripciones.",
  falta_consentimiento: "Marca la autorización para continuar.",
  datos_incompletos: "Faltan nombres, apellidos o el nombre del tutor.",
  datos_largos: "El club o el usuario de Lichess son demasiado largos.",
  telefono_invalido: "El celular debe tener 9 dígitos y empezar con 9.",
  correo_invalido: "Revisa el correo.",
  fecha_invalida: "Revisa la fecha de nacimiento.",
  sin_categoria: "La fecha de nacimiento no corresponde a ninguna categoría del torneo.",
};
function error(e, porDefecto = "No se pudo conectar con la base de datos del club. Intenta de nuevo.") {
  const clave = Object.keys(MENSAJES).find((k) => String(e?.message ?? "").includes(k));
  return new Error(clave ? MENSAJES[clave] : porDefecto);
}
const revisar = ({ data, error: e }, porDefecto) => {
  if (e) throw error(e, porDefecto);
  return data;
};

// ---------------------------------------------------------------- formas (tabla ↔ store.js)
const aTorneo = (r) => ({
  id: r.id,
  nombre: r.nombre,
  modalidad: r.modalidad,
  anio: r.anio ?? (r.fecha_inicio ? Number(r.fecha_inicio.slice(0, 4)) : null),
  fecha: r.fecha_inicio ?? "",
  ritmo: r.ritmo ?? "",
  cupo: r.cupo ?? "",
  costo: r.costo ?? "",
  sede: r.sede ?? "",
  categorias: r.categorias ?? [],
  bases: r.bases_url ?? "",
  foto: r.foto_url ?? "",
  descripcion: r.descripcion ?? "",
  estado: r.estado,
  creado_en: r.creado_en,
});
const deTorneo = (t) => ({
  nombre: t.nombre,
  modalidad: t.modalidad || "Presencial",
  anio: t.anio || null,
  fecha_inicio: t.fecha || null,
  ritmo: t.ritmo || null,
  cupo: t.cupo || null,
  costo: t.costo || null,
  sede: t.sede || null,
  ...(t.categorias?.length ? { categorias: t.categorias } : {}),
  bases_url: t.bases || null,
  foto_url: t.foto || null,
  descripcion: t.descripcion || null,
});
const aInscripcion = (r) => {
  const j = r.jugador ?? {};
  const t = j.tutores?.[0] ?? {};
  return {
    id: r.id,
    torneo_id: r.torneo_id,
    nombres: j.nombres ?? "",
    apellidos: j.apellidos ?? "",
    fecha_nacimiento: j.fecha_nacimiento ?? "",
    categoria: r.categoria,
    nivel: r.nivel ?? "",
    club: r.club ?? "",
    lichess: j.usuario_lichess ?? "",
    fide_id: j.fide_id ?? "",
    tutor_nombre: t.nombre ?? "",
    tutor_telefono: t.telefono ?? "",
    tutor_correo: t.correo ?? "",
    consentimiento: !!t.consentimiento,
    consentimiento_fecha: t.consentimiento_fecha ?? "",
    estado_pago: r.estado_pago,
    motivo: r.motivo ?? "",
    voucher_url: r.voucher_url,
    creado_en: r.creado_en,
  };
};

// ---------------------------------------------------------------- lo público (cualquier visitante)
export async function cargarPublico() {
  const [c, t, n, r, p] = await Promise.all([
    sb.from("contenido").select("campo, valor"),
    sb.from("torneos").select("*").order("creado_en"),
    sb.from("noticias").select("*").order("fecha_publicacion", { ascending: false }),
    sb.from("resultados_publicados").select("*").order("publicado_en"),
    sb.from("inscritos_publicos").select("*").order("creado_en"),
  ]);
  for (const x of [c, t, n, r, p]) if (x.error) console.warn("Base de datos:", x.error.message);
  const mias = leerMias();
  let estados = [];
  if (mias.length) {
    const res = await sb.rpc("estado_inscripciones", { p: mias.map(({ id, token }) => ({ id, token })) });
    estados = res.data ?? [];
    // Las que el club borró (derecho de supresión) dejan de aparecer también aquí.
    if (!res.error) guardarMias(mias.filter((m) => estados.some((e) => e.id === m.id)));
  }
  return {
    contenido: Object.fromEntries((c.data ?? []).filter((x) => x.valor != null).map((x) => [x.campo, x.valor])),
    // «verano-2027» tiene su propia página fija: no se repite entre los creados en el panel.
    torneos: (t.data ?? []).filter((x) => x.id !== "verano-2027").map(aTorneo),
    noticias: (n.data ?? []).map((x) => ({ id: x.id, titulo: x.titulo, cuerpo: x.cuerpo, fecha: x.fecha_publicacion })),
    resultados: Object.fromEntries(
      (r.data ?? []).map((x) => [x.clave, { nombre: x.nombre, origen: x.origen ?? "", filas: x.filas ?? [], cronica: x.cronica ?? "", publicado_en: x.publicado_en }]),
    ),
    publicos: (p.data ?? []).map((x) => ({ torneo_id: x.torneo_id, nombre: x.nombre, categoria: x.categoria, club: x.club, validado: x.validado })),
    mias: mias
      .map((m) => ({ ...m, ...estados.find((e) => e.id === m.id) }))
      .filter((m) => m.estado_pago),
  };
}

export async function inscribir(datos) {
  const r = revisar(await sb.rpc("inscribir", { p: datos }), "No se pudo enviar la inscripción. Revisa tu conexión e intenta de nuevo.");
  const mia = { id: r.id, token: r.token, torneo_id: datos.torneo_id, nombres: datos.nombres, apellidos: datos.apellidos };
  guardarMias([...leerMias(), mia]);
  return { ...datos, id: r.id, categoria: r.categoria, estado_pago: "pendiente", motivo: "", creado_en: r.creado_en };
}

export async function subirVoucher(id, archivo) {
  const mia = leerMias().find((m) => m.id === id);
  if (!mia) throw new Error("No encontramos la inscripción en este navegador.");
  revisar(
    await sb.storage.from("vouchers").upload(`inscripciones/${id}`, archivo, { contentType: archivo.type, upsert: false }),
    "No se pudo subir el comprobante.",
  );
  const ok = revisar(await sb.rpc("registrar_voucher", { p_id: id, p_token: mia.token }), "No se pudo registrar el comprobante.");
  if (!ok) throw new Error("No se pudo registrar el comprobante.");
}

// ---------------------------------------------------------------- panel (personal del club)
export async function sesion() {
  const { data } = await sb.auth.getSession();
  const usuario = data.session?.user;
  if (!usuario) return null;
  const perfil = (await sb.from("perfiles").select("nombre, rol").eq("id", usuario.id).maybeSingle()).data;
  return perfil ? { ...perfil, correo: usuario.email } : null;
}
export async function entrar(correo, clave) {
  const { error: e } = await sb.auth.signInWithPassword({ email: correo, password: clave });
  if (e) throw new Error("Correo o contraseña incorrectos.");
  const s = await sesion();
  if (!s) {
    await sb.auth.signOut();
    throw new Error("Esta cuenta no tiene acceso al panel. Pide al administrador que te dé un rol.");
  }
  return s;
}
export const salir = () => sb.auth.signOut();

export async function cargarPanel() {
  const filas = revisar(
    await sb
      .from("inscripciones")
      .select(
        "id, torneo_id, categoria, nivel, club, estado_pago, motivo, voucher_url, creado_en, jugador:jugadores(nombres, apellidos, fecha_nacimiento, usuario_lichess, fide_id, tutores(nombre, telefono, correo, consentimiento, consentimiento_fecha))",
      )
      .order("creado_en"),
  );
  return filas.map(aInscripcion);
}
export async function cambiarEstadoPago(id, estado, motivo) {
  const quien = (await sb.auth.getUser()).data.user?.id ?? null;
  const pendiente = estado === "pendiente";
  revisar(
    await sb
      .from("inscripciones")
      .update({ estado_pago: estado, motivo: motivo || null, validado_por: pendiente ? null : quien, validado_en: pendiente ? null : new Date().toISOString() })
      .eq("id", id),
  );
}
export async function leerVoucher(id) {
  const { data, error: e } = await sb.storage.from("vouchers").download(`inscripciones/${id}`);
  return e ? null : data;
}
// Derecho de supresión: borra el comprobante, el jugador y (en cascada) su tutor e inscripciones.
export async function suprimirInscripcion(id) {
  const fila = revisar(await sb.from("inscripciones").select("jugador_id").eq("id", id).maybeSingle());
  await sb.storage.from("vouchers").remove([`inscripciones/${id}`]);
  if (fila) revisar(await sb.from("jugadores").delete().eq("id", fila.jugador_id));
}

export const crearTorneo = async (t) => aTorneo(revisar(await sb.from("torneos").insert(deTorneo(t)).select().single()));
export const borrarTorneo = async (id) => void revisar(await sb.from("torneos").delete().eq("id", id));
export const crearNoticia = async ({ titulo, cuerpo }) => {
  const x = revisar(await sb.from("noticias").insert({ titulo, cuerpo }).select().single());
  return { id: x.id, titulo: x.titulo, cuerpo: x.cuerpo, fecha: x.fecha_publicacion };
};
export const borrarNoticia = async (id) => void revisar(await sb.from("noticias").delete().eq("id", id));
export const publicarResultados = async (clave, d) =>
  void revisar(await sb.from("resultados_publicados").upsert({ clave, nombre: d.nombre, origen: d.origen, filas: d.filas, cronica: d.cronica || null }));
export const borrarResultados = async (clave) => void revisar(await sb.from("resultados_publicados").delete().eq("clave", clave));

export async function guardarContenido(valores) {
  const llenos = Object.entries(valores).filter(([, v]) => v != null).map(([campo, valor]) => ({ campo, valor, actualizado_en: new Date().toISOString() }));
  const vacios = Object.entries(valores).filter(([, v]) => v == null).map(([campo]) => campo);
  if (llenos.length) revisar(await sb.from("contenido").upsert(llenos));
  if (vacios.length) revisar(await sb.from("contenido").delete().in("campo", vacios));
}

// ---------------------------------------------------------------- personal (solo el admin)
// Las cuentas se crean en Supabase → Authentication (sin registro público); aquí se da o quita el rol.
export const personal = async () => revisar(await sb.rpc("personal"));
export async function darAcceso(correo, nombre, rol) {
  const { error: e } = await sb.rpc("dar_acceso", { p_correo: correo, p_nombre: nombre, p_rol: rol });
  if (e?.message.includes("cuenta_no_existe")) throw new Error("Esa cuenta aún no existe: créala primero en Supabase → Authentication → Add user.");
  if (e?.message.includes("ultimo_admin")) throw new Error("Debe quedar al menos un administrador.");
  if (e) throw error(e, "No se pudo dar el acceso.");
}
export async function quitarAcceso(correo) {
  const { error: e } = await sb.rpc("quitar_acceso", { p_correo: correo });
  if (e?.message.includes("ultimo_admin")) throw new Error("Debe quedar al menos un administrador.");
  if (e?.message.includes("a_ti_mismo")) throw new Error("No puedes quitarte el acceso a ti mismo.");
  if (e) throw error(e, "No se pudo quitar el acceso.");
}
