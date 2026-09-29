// Cómo se muestran los usuarios de Lichess en la web (privacidad de menores).
// Lógica pura, sin navegador: la usan scripts/estadisticas.mjs y las pruebas.

const PUNTOS = "•••••";
export const RESERVADO = "Jugador reservado";

// 7 o más dígitos seguidos pueden ser un DNI o un código de alumno: se deja el primer dígito
// y el resto se tapa con 5 puntos fijos (la longitud tampoco revela nada).
// «A62941402SAMIR» → «A6•••••SAMIR».
export const enmascarar = (u) => String(u ?? "").replace(/\d{7,}/g, (m) => m[0] + PUNTOS);
export const tieneDigitosSensibles = (u) => /\d{7,}/.test(String(u ?? ""));

/**
 * Reglas del club sobre sus jugadores.
 * - alias: [{ principal, secundarias: [], confirmado }] → solo se fusionan los confirmados.
 * - ocultos: usuarios que no se muestran en ningún listado (se siguen contando en los totales).
 * - sensibles: nicks que no van en la portada ni en destacados (sí en el Salón completo).
 */
export function crearReglas({ alias = [], ocultos = [], sensibles = [] } = {}) {
  const aPrincipal = new Map();
  const grafia = new Map();
  for (const a of alias) {
    if (a?.confirmado !== true) continue;
    const p = a.principal.toLowerCase();
    grafia.set(p, a.principal);
    for (const s of a.secundarias ?? []) if (s.toLowerCase() !== p) aPrincipal.set(s.toLowerCase(), p);
  }
  const clave = (u) => {
    const l = String(u).toLowerCase();
    return aPrincipal.get(l) ?? l;
  };
  const conjunto = (lista) => new Set(lista.map((u) => clave(u)));
  const ocultosSet = conjunto(ocultos);
  const sensiblesSet = conjunto(sensibles);
  return {
    clave,
    grafiaPrincipal: (c) => grafia.get(c) ?? null,
    oculto: (c) => ocultosSet.has(c),
    sensible: (c) => sensiblesSet.has(c),
    fusionadas: aPrincipal.size,
  };
}

// Nombre público a partir de la grafía elegida.
export function nombrePublico(grafia, { oculto = false } = {}) {
  return oculto ? RESERVADO : enmascarar(grafia);
}
