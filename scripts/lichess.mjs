// Actualiza la caché local de Lichess del Ajedrez Club Mokewa.
//
// Reglas de la API de Lichess (https://lichess.org/api):
//   - una petición a la vez;
//   - si responde 429, esperar un minuto completo antes de reintentar.
// Por eso la web nunca llama a Lichess directo: lee lo que este script deja en data/lichess/.
//
// Es incremental: solo descarga resultados de torneos nuevos o que no estaban terminados.
// Si Lichess falla, se conserva la última versión válida (la web muestra su fecha).
//
// Uso: node scripts/lichess.mjs            (actualiza todo)
//      node scripts/lichess.mjs --sin-red  (no descarga; útil para probar)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EQUIPO = "ajedrez-club-mokewa";
const CUENTA_CLUB = "ajedrez_club_mokewa";
const API = "https://lichess.org";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(RAIZ, "data", "lichess");
const UA = "mokewa-hub/0.1 (demo del sitio web del Ajedrez Club Mokewa)";

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function pedir(url, { ndjson = false, intentos = 3 } = {}) {
  for (let i = 1; i <= intentos; i++) {
    let res;
    try {
      res = await fetch(url, {
        headers: { Accept: ndjson ? "application/x-ndjson" : "application/json", "User-Agent": UA },
      });
    } catch (e) {
      console.warn(`  red caída (${e.message}); intento ${i}/${intentos}`);
      await dormir(5000);
      continue;
    }
    if (res.status === 429) {
      console.warn("  Lichess pidió esperar (429): pausa de 61 s");
      await dormir(61_000);
      continue;
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} en ${url}`);
    const texto = await res.text();
    if (!ndjson) return JSON.parse(texto);
    return texto.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
  }
  throw new Error(`Sin respuesta útil de ${url}`);
}

const leerNdjson = async (f) =>
  existsSync(f) ? (await readFile(f, "utf8")).split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l)) : [];
const escribirNdjson = (f, filas) => writeFile(f, filas.map((x) => JSON.stringify(x)).join("\n") + "\n", "utf8");
const leerJson = async (f, defecto) => (existsSync(f) ? JSON.parse(await readFile(f, "utf8")) : defecto);

// Une la lista nueva con la guardada (por id), la nueva manda.
function unir(viejos, nuevos) {
  const m = new Map(viejos.map((t) => [t.id, t]));
  for (const t of nuevos) m.set(t.id, t);
  return [...m.values()];
}

const terminado = (t, tipo) => (tipo === "swiss" ? t.status === "finished" : t.status === 30);

async function main() {
  await mkdir(DIR, { recursive: true });
  if (process.argv.includes("--sin-red")) {
    console.log("Modo --sin-red: no se descarga nada.");
    return;
  }
  const meta = await leerJson(path.join(DIR, "meta.json"), {});

  console.log("Equipo…");
  const equipo = await pedir(`${API}/api/team/${EQUIPO}`);
  if (equipo) await writeFile(path.join(DIR, "equipo.json"), JSON.stringify(equipo, null, 1), "utf8");

  // max=500 cubre todo el historial actual (156 torneos) con holgura.
  console.log("Torneos arena…");
  const arenasNuevas = (await pedir(`${API}/api/team/${EQUIPO}/arena?max=500`, { ndjson: true })) ?? [];
  const arenas = unir(await leerNdjson(path.join(DIR, "arenas.ndjson")), arenasNuevas);
  await escribirNdjson(path.join(DIR, "arenas.ndjson"), arenas);

  console.log("Torneos suizos…");
  const suizosNuevos = (await pedir(`${API}/api/team/${EQUIPO}/swiss?max=500`, { ndjson: true })) ?? [];
  const suizos = unir(await leerNdjson(path.join(DIR, "swiss.ndjson")), suizosNuevos);
  await escribirNdjson(path.join(DIR, "swiss.ndjson"), suizos);

  // Resultados: solo lo que falta o lo que no estaba terminado cuando se guardó.
  const resultados = await leerJson(path.join(DIR, "resultados.json"), []);
  const porId = new Map(resultados.map((r) => [r.id, r]));
  // Los datos heredados (descarga del 26-09-2026) no traían la marca "terminado": se infiere
  // del estado del torneo, para no volver a bajar los 156 resultados.
  const tipos = new Map([...suizos.map((t) => [t.id, t]), ...arenas.map((t) => [t.id, t])]);
  for (const r of porId.values()) {
    if (r.terminado === undefined && tipos.has(r.id)) r.terminado = terminado(tipos.get(r.id), r.tipo);
  }
  const pendientes = [
    ...suizos.map((t) => ({ t, tipo: "swiss", fecha: t.startsAt })),
    ...arenas.map((t) => ({ t, tipo: "arena", fecha: t.startsAt })),
  ].filter(({ t }) => {
    const guardado = porId.get(t.id);
    return !guardado || !guardado.terminado;
  });

  console.log(`Resultados por descargar: ${pendientes.length}`);
  for (const { t, tipo, fecha } of pendientes) {
    const url = tipo === "swiss" ? `${API}/api/swiss/${t.id}/results` : `${API}/api/tournament/${t.id}/results`;
    try {
      const res = (await pedir(url, { ndjson: true })) ?? [];
      porId.set(t.id, { tipo, id: t.id, fecha, res, terminado: terminado(t, tipo) });
      console.log(`  ${t.id} (${tipo}): ${res.length} jugadores`);
    } catch (e) {
      console.warn(`  ${t.id}: ${e.message} — se conserva lo guardado`);
    }
    await dormir(400);
  }
  await writeFile(path.join(DIR, "resultados.json"), JSON.stringify([...porId.values()]), "utf8");

  console.log("Cuenta oficial del club…");
  const cuenta = await pedir(`${API}/api/user/${CUENTA_CLUB}`);
  if (cuenta) await writeFile(path.join(DIR, "cuenta_club.json"), JSON.stringify(cuenta, null, 1), "utf8");

  meta.actualizado_en = new Date().toISOString();
  meta.fuente = `${API}/api/team/${EQUIPO}`;
  await writeFile(path.join(DIR, "meta.json"), JSON.stringify(meta, null, 1), "utf8");
  console.log(`Listo: ${arenas.length} arenas, ${suizos.length} suizos, ${porId.size} con resultados.`);
}

main().catch((e) => {
  // Degradación elegante: si algo falla, la caché anterior sigue intacta y la web se construye igual.
  console.error("No se pudo actualizar desde Lichess:", e.message);
  process.exitCode = 0;
});
