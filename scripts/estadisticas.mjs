// Calcula la historia del club a partir de la caché de Lichess (data/lichess/).
// Nada de lo que muestra el Salón de la Fama está escrito a mano: sale de aquí.
//
// Salidas:
//   src/data/club.json         → cifras, temporadas, récords y torneos (se usa al construir)
//   public/datos/jugadores.json → historial por jugador (buscador y ficha, se carga a pedido)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(RAIZ, "data", "lichess");

const leerNdjson = async (f) =>
  existsSync(f) ? (await readFile(f, "utf8")).split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l)) : [];
const leerJson = async (f, defecto) => (existsSync(f) ? JSON.parse(await readFile(f, "utf8")) : defecto);

// El club es de Moquegua: las fechas se leen en hora de Lima (UTC-5, sin horario de verano).
const LIMA_MS = -5 * 3600 * 1000;
const aFecha = (v) => new Date(typeof v === "number" ? v : Date.parse(v));
const anioLima = (d) => new Date(d.getTime() + LIMA_MS).getUTCFullYear();
const isoLima = (d) => new Date(d.getTime() + LIMA_MS).toISOString().slice(0, 10);

export function ritmo(clock) {
  if (!clock) return { texto: "—", tipo: "otro" };
  const min = clock.limit / 60;
  const texto = `${Number.isInteger(min) ? min : min.toFixed(1).replace(".", ",")}+${clock.increment}`;
  const estimado = clock.limit + 40 * clock.increment; // criterio de Lichess
  const tipo = estimado < 180 ? "bala" : estimado < 480 ? "blitz" : estimado < 1500 ? "rápidas" : "clásico";
  return { texto, tipo };
}

function limpiarNombre(nombre) {
  return nombre.replace(/(\s+Arena)+$/i, "").replace(/\s{2,}/g, " ").trim();
}

// Familias de torneos que el club repite (sus «productos»).
const FORMATOS = [
  ["Jueves de Bala", /jueves de (bala|bullet)|bullet 4/i],
  ["Viernes de Rápidas", /viernes de r[aá]pi(das|s)/i],
  ["Blitz de martes y viernes", /(martes|viernes) de blitz/i],
  ["Temáticos y finales", /tem[aá]tico|finales|rey (y )?dama|rey dama|torres|alfiles|caballos/i],
  ["Torneos híbridos por nivel", /h[ií]brido/i],
  ["Torneos de verano", /verano/i],
  ["Batallas interclubes", /team battle|integraci[oó]n inca|match/i],
  ["Escolares y categorías", /escolar|sub ?\d|categor[ií]a|novatos|juvenil/i],
  ["Relámpagos", /rel[aá]mpago|el m[aá]s r[aá]pido/i],
  ["Prácticas y entrenamiento", /pr[aá]ctica|entrenamiento|calentamiento|precisi[oó]n|prueba|previ[ao]/i],
  ["Torneos con premios y sorteos", /premio|sorteo|pollada|simult/i],
  ["Torneos abiertos del club", /mokewa/i],
];
const formatoDe = (nombre) => (FORMATOS.find(([, re]) => re.test(nombre)) ?? ["Otros"])[0];

export function calcular({ arenas, suizos, resultados, equipo, cuenta, meta }, ahora = new Date()) {
  const info = new Map();
  for (const t of suizos) {
    const d = aFecha(t.startsAt);
    info.set(t.id, {
      id: t.id, tipo: "suizo", nombre: limpiarNombre(t.name), fecha: d.toISOString(), dia: isoLima(d), anio: anioLima(d),
      ritmo: ritmo(t.clock), jugadores: t.nbPlayers ?? 0, rondas: t.nbRounds ?? null, estado: t.status,
      terminado: t.status === "finished", url: `https://lichess.org/swiss/${t.id}`,
      rating_promedio: t.stats?.averageRating ?? null,
    });
  }
  for (const t of arenas) {
    const d = aFecha(t.startsAt);
    info.set(t.id, {
      id: t.id, tipo: /team battle/i.test(t.fullName) ? "batalla" : "arena", nombre: limpiarNombre(t.fullName),
      fecha: d.toISOString(), dia: isoLima(d), anio: anioLima(d), ritmo: ritmo(t.clock), jugadores: t.nbPlayers ?? 0,
      minutos: t.minutes, estado: t.status, terminado: t.status === 30, url: `https://lichess.org/tournament/${t.id}`,
    });
  }
  for (const t of info.values()) t.formato = formatoDe(t.nombre);

  // Jugadores: se agrupa por usuario en minúsculas (Lichess no distingue mayúsculas).
  const jug = new Map();
  const grafias = new Map();
  for (const r of resultados) {
    const t = info.get(r.id);
    if (!t) continue;
    const podio = [];
    for (const x of r.res ?? []) {
      const u = x.username.toLowerCase();
      const g = grafias.get(u) ?? new Map();
      g.set(x.username, (g.get(x.username) ?? 0) + 1);
      grafias.set(u, g);
      if (!jug.has(u)) jug.set(u, { u, hist: [] });
      jug.get(u).hist.push({ id: r.id, puesto: x.rank, puntos: x.points ?? x.score ?? null, anio: t.anio, dia: t.dia });
      if (x.rank <= 3) podio.push({ u, puesto: x.rank, puntos: x.points ?? x.score ?? null });
    }
    podio.sort((a, b) => a.puesto - b.puesto);
    t.podio = podio;
    t.ganador = podio.find((p) => p.puesto === 1)?.u ?? null;
    t.con_resultados = (r.res ?? []).length;
  }
  const mostrar = (u) => [...(grafias.get(u)?.entries() ?? [[u, 1]])].sort((a, b) => b[1] - a[1])[0][0];
  for (const t of info.values()) {
    t.podio = (t.podio ?? []).map((p) => ({ ...p, u: mostrar(p.u) }));
    if (t.ganador) t.ganador = mostrar(t.ganador);
  }

  const perfiles = [...jug.values()].map((j) => {
    const anios = [...new Set(j.hist.map((h) => h.anio))].sort();
    j.hist.sort((a, b) => a.dia.localeCompare(b.dia));
    return {
      u: mostrar(j.u),
      clave: j.u,
      torneos: new Set(j.hist.map((h) => h.id)).size,
      titulos: j.hist.filter((h) => h.puesto === 1).length,
      podios: j.hist.filter((h) => h.puesto <= 3).length,
      mejor: Math.min(...j.hist.map((h) => h.puesto)),
      primera: j.hist[0].dia,
      ultima: j.hist.at(-1).dia,
      temporadas: anios,
      hist: j.hist,
    };
  });

  const torneos = [...info.values()].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const finalizados = torneos.filter((t) => t.terminado);
  const proximos = torneos.filter((t) => !t.terminado && new Date(t.fecha) > ahora).reverse();

  const anios = [...new Set(torneos.map((t) => t.anio))].sort();
  const temporadas = anios.map((anio) => {
    const ts = torneos.filter((t) => t.anio === anio);
    const quienes = perfiles.filter((p) => p.hist.some((h) => h.anio === anio));
    const titulosAnio = quienes
      .map((p) => ({ u: p.u, n: p.hist.filter((h) => h.anio === anio && h.puesto === 1).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n || a.u.localeCompare(b.u));
    const mayor = [...ts].sort((a, b) => b.jugadores - a.jugadores)[0];
    return {
      anio,
      torneos: ts.length,
      arenas: ts.filter((t) => t.tipo !== "suizo").length,
      suizos: ts.filter((t) => t.tipo === "suizo").length,
      participaciones: ts.reduce((s, t) => s + t.jugadores, 0),
      jugadores: quienes.length,
      rey: titulosAnio[0] ?? null,
      mayor: mayor ? { id: mayor.id, nombre: mayor.nombre, jugadores: mayor.jugadores, url: mayor.url } : null,
    };
  });

  const orden = (k) => [...perfiles].sort((a, b) => b[k] - a[k] || b.torneos - a.torneos || a.u.localeCompare(b.u));
  const campeones = orden("titulos").filter((p) => p.titulos > 0);
  const fieles = orden("torneos").filter((p) => p.torneos >= 10);
  const masPodios = orden("podios")[0];
  const masTemporadas = [...perfiles].sort((a, b) => b.temporadas.length - a.temporadas.length || b.torneos - a.torneos)[0];
  const mayorTorneo = [...torneos].sort((a, b) => b.jugadores - a.jugadores)[0];

  const suizosTerminados = finalizados.filter((t) => t.tipo === "suizo");
  const mediana = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null;
  };

  const anioMax = Math.max(...anios);
  // «Por recuperar»: compitieron en 2023 o antes y no volvieron en los dos últimos años.
  const recientes = new Set([anioMax - 1, anioMax]);
  const porRecuperar = perfiles.filter((p) => p.temporadas[0] <= anioMax - 3 && !p.temporadas.some((a) => recientes.has(a)));

  const formatos = Object.entries(
    torneos.reduce((acc, t) => ((acc[t.formato] = (acc[t.formato] ?? 0) + 1), acc), {}),
  )
    .map(([nombre, n]) => ({ nombre, n }))
    .sort((a, b) => b.n - a.n);

  const cuentaClub = cuenta
    ? {
        usuario: cuenta.username,
        creada: cuenta.createdAt ? isoLima(new Date(cuenta.createdAt)) : null,
        partidas: cuenta.count?.all ?? null,
        ratings: Object.fromEntries(
          ["bullet", "blitz", "rapid", "classical", "puzzle"]
            .filter((k) => cuenta.perfs?.[k]?.games || cuenta.perfs?.[k]?.rating)
            .map((k) => [k, { rating: cuenta.perfs[k].rating, partidas: cuenta.perfs[k].games ?? null, provisional: !!cuenta.perfs[k].prov }]),
        ),
      }
    : null;

  const club = {
    actualizado_en: meta?.actualizado_en ?? "2026-09-26T12:00:00Z",
    equipo: equipo
      ? { nombre: equipo.name, miembros: equipo.nbMembers, lideres: (equipo.leaders ?? []).map((l) => l.name), abierto: equipo.open, url: "https://lichess.org/team/ajedrez-club-mokewa" }
      : { nombre: "Ajedrez Club Mokewa", miembros: 371, lideres: [], abierto: false, url: "https://lichess.org/team/ajedrez-club-mokewa" },
    totales: {
      torneos: torneos.length,
      arenas: torneos.filter((t) => t.tipo !== "suizo").length,
      suizos: torneos.filter((t) => t.tipo === "suizo").length,
      participaciones: torneos.reduce((s, t) => s + t.jugadores, 0),
      jugadores: perfiles.length,
      campeones: campeones.length,
      fieles: fieles.length,
      desde: anios[0],
      mediana_suizo: mediana(suizosTerminados.map((t) => t.jugadores)),
      max_suizo: Math.max(0, ...suizosTerminados.map((t) => t.jugadores)),
      rating_mediano: mediana(suizosTerminados.map((t) => t.rating_promedio).filter(Boolean)),
    },
    records: {
      mas_torneos: { u: fieles[0]?.u, n: fieles[0]?.torneos },
      mas_titulos: { u: campeones[0]?.u, n: campeones[0]?.titulos },
      mas_podios: { u: masPodios?.u, n: masPodios?.podios },
      mas_temporadas: { u: masTemporadas?.u, n: masTemporadas?.temporadas.length },
      mayor_torneo: mayorTorneo ? { nombre: mayorTorneo.nombre, jugadores: mayorTorneo.jugadores, dia: mayorTorneo.dia, url: mayorTorneo.url } : null,
    },
    campeones: campeones.map((p) => ({ u: p.u, titulos: p.titulos, podios: p.podios, torneos: p.torneos, temporadas: p.temporadas })),
    fieles: fieles.map((p) => ({ u: p.u, torneos: p.torneos, temporadas: p.temporadas.length })),
    temporadas,
    formatos,
    torneos: torneos.map(({ rating_promedio, estado, ...t }) => t),
    proximos: proximos.map((t) => t.id),
    ultimo: finalizados[0]?.id ?? null,
    // Uso interno del panel (no se publica en páginas públicas).
    interno: {
      por_recuperar: porRecuperar.length,
      criterio_recuperar: `Jugaron por primera vez en ${anioMax - 3} o antes y no compitieron en ${anioMax - 1} ni ${anioMax}.`,
      meses_sin_torneo_online: null,
    },
    cuenta_club: cuentaClub,
  };

  // Índice compacto por jugador para el buscador y la ficha (se carga solo cuando hace falta).
  const indiceTorneos = Object.fromEntries(torneos.map((t) => [t.id, [t.nombre, t.dia, t.tipo, t.jugadores, t.ritmo.texto]]));
  const jugadores = {
    actualizado_en: club.actualizado_en,
    torneos: indiceTorneos,
    jugadores: perfiles
      .sort((a, b) => b.torneos - a.torneos || a.u.localeCompare(b.u))
      .map((p) => ({ u: p.u, t: p.torneos, c: p.titulos, p: p.podios, m: p.mejor, a: p.temporadas, h: p.hist.map((h) => [h.id, h.puesto, h.puntos]) })),
  };
  return { club, jugadores };
}

async function main() {
  const datos = {
    arenas: await leerNdjson(path.join(DIR, "arenas.ndjson")),
    suizos: await leerNdjson(path.join(DIR, "swiss.ndjson")),
    resultados: await leerJson(path.join(DIR, "resultados.json"), []),
    equipo: await leerJson(path.join(DIR, "equipo.json"), null),
    cuenta: await leerJson(path.join(DIR, "cuenta_club.json"), null),
    meta: await leerJson(path.join(DIR, "meta.json"), null),
  };
  const { club, jugadores } = calcular(datos);
  await mkdir(path.join(RAIZ, "src", "data"), { recursive: true });
  await mkdir(path.join(RAIZ, "public", "datos"), { recursive: true });
  await writeFile(path.join(RAIZ, "src", "data", "club.json"), JSON.stringify(club), "utf8");
  await writeFile(path.join(RAIZ, "public", "datos", "jugadores.json"), JSON.stringify(jugadores), "utf8");
  const t = club.totales;
  console.log(
    `Historia del club: ${t.torneos} torneos (${t.arenas} arenas, ${t.suizos} suizos), ${t.participaciones} participaciones, ` +
      `${t.jugadores} jugadores, ${t.campeones} campeones, ${t.fieles} con 10+ torneos, récord ${club.records.mas_torneos.n} torneos, ` +
      `${club.interno.por_recuperar} por recuperar.`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
