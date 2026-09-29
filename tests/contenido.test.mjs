// Pruebas del contenido editable del club (src/data/contenido.json) y del componente <Dato>.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contenido = JSON.parse(await readFile(path.join(RAIZ, "src/data/contenido.json"), "utf8"));

async function archivos(dir) {
  const salida = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) salida.push(...(await archivos(p)));
    else if (/\.(astro|js)$/.test(e.name)) salida.push(p);
  }
  return salida;
}

test("todo campo usado en las páginas existe en contenido.json", async () => {
  const usados = new Set();
  for (const f of await archivos(path.join(RAIZ, "src"))) {
    const s = await readFile(f, "utf8");
    for (const m of s.matchAll(/campo="([a-z_]+)"/g)) usados.add(m[1]);
    for (const m of s.matchAll(/campo:\s*"([a-z_]+)"/g)) usados.add(m[1]);
  }
  const faltan = [...usados].filter((c) => !(c in contenido.campos));
  assert.deepEqual(faltan, []);
  assert.ok(usados.size >= 10);
});

test("no quedan chips «por confirmar» sueltos fuera de <Dato> en las páginas públicas", async () => {
  const permitidos = ["panel.astro", "acerca-de-la-demo.astro", "Base.astro", "jugador.astro", "Dato.astro"];
  const sueltos = [];
  for (const f of await archivos(path.join(RAIZ, "src"))) {
    if (!f.endsWith(".astro") || permitidos.includes(path.basename(f))) continue;
    if ((await readFile(f, "utf8")).includes('class="pc"')) sueltos.push(path.relative(RAIZ, f));
  }
  assert.deepEqual(sueltos, []);
});
