// Categorías por edad (lógica pura, sin navegador: se prueba con node --test).
export const CATEGORIAS = ["Sub-8", "Sub-10", "Sub-12", "Sub-14", "Sub-16", "Sub-18", "Libre"];

// Categoría por edad al 1 de enero del año del torneo (criterio FIDE para juveniles).
export function edadAl1Enero(fechaNac, anio) {
  const [a, m, d] = fechaNac.split("-").map(Number);
  return anio - a - (m === 1 && d === 1 ? 0 : 1);
}
export function categoriaPara(fechaNac, anio, categorias = CATEGORIAS) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNac ?? "")) return null;
  const edad = edadAl1Enero(fechaNac, anio);
  if (edad < 3 || edad > 100) return null;
  const subs = categorias
    .map((c) => [c, Number(c.match(/sub-?(\d+)/i)?.[1])])
    .filter(([, n]) => n)
    .sort((a, b) => a[1] - b[1]);
  for (const [c, n] of subs) if (edad < n) return c;
  return categorias.includes("Libre") ? "Libre" : null;
}
export const esMenor = (fechaNac, hoy = new Date()) => {
  const [a, m, d] = fechaNac.split("-").map(Number);
  let edad = hoy.getFullYear() - a;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) edad--;
  return edad < 18;
};

