// Formatos en español de Perú. Miles con espacio fino (norma RAE: «2 832»).

export const miles = (n) =>
  n == null ? "—" : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

// dia = "AAAA-MM-DD" (ya en hora de Lima)
export function fechaLarga(dia) {
  if (!dia) return "—";
  const [a, m, d] = dia.slice(0, 10).split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}
export function fechaCorta(dia) {
  if (!dia) return "—";
  const [a, m, d] = dia.slice(0, 10).split("-").map(Number);
  return `${d} ${MESES_CORTOS[m - 1]} ${a}`;
}
export function mesAnio(dia) {
  const [a, m] = dia.slice(0, 7).split("-").map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

export function fechaHoraLima(iso) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export const TIPO_TORNEO = { suizo: "Suizo", arena: "Arena", batalla: "Batalla interclubes" };

export const plural = (n, uno, varios) => `${miles(n)} ${n === 1 ? uno : varios}`;
