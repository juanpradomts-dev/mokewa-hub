// Piezas de ajedrez en SVG, en vez de los símbolos Unicode (♙ ♘ ♕ ♛), que cada sistema dibuja distinto
// (o como emoji). Set «Cburnett» de Wikimedia Commons, el mismo de Lichess; trazados sin modificar.
// Copyright (c) 2006, Colin M.L. Burnett. Licencia BSD de 3 cláusulas (texto completo en
// CREDITOS-PIEZAS.md); el autor también las ofrece bajo GFDL, CC BY-SA 3.0 y GPL.
//
// Colores (CSS): tono «claro» = cuerpo var(--pr, #fff) con trazo currentColor;
// tono «oscuro» = cuerpo currentColor con detalles var(--pd, #fff).

const T = "stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round";
const C = "fill:var(--pr,#fff)"; // cuerpo de la pieza clara
const O = "fill:currentColor"; // cuerpo de la pieza oscura
const D = "fill:none;stroke:var(--pd,#fff)"; // detalles de la pieza oscura

const PEON =
  "m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z";

const CABALLO_A = "M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18";
const CABALLO_B =
  "M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10";
const CABALLO_OJO = "M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z";
const CABALLO_NARIZ = "M 15 15.5 A 0.5 1.5 0 1 1 14,15.5 A 0.5 1.5 0 1 1 15 15.5 z";
const CABALLO_NARIZ_T = "matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)";
const CABALLO_LUZ =
  "M 24.55,10.4 L 24.1,11.85 L 24.6,12 C 27.75,13 30.25,14.49 32.5,18.75 C 34.75,23.01 35.75,29.06 35.25,39 L 35.2,39.5 L 37.45,39.5 L 37.5,39 C 38,28.94 36.62,22.15 34.25,17.66 C 31.88,13.17 28.46,11.02 25.06,10.5 L 24.55,10.4 z";

const ALFIL = [
  "M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.65,38.99 6.68,38.97 6,38 C 7.35,36.54 9,36 9,36 z",
  "M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z",
  "M 25 8 A 2.5 2.5 0 1 1 20,8 A 2.5 2.5 0 1 1 25 8 z",
];
const ALFIL_LINEAS = "M 17.5,26 L 27.5,26 M 15,30 L 30,30 M 22.5,15.5 L 22.5,20.5 M 20,18 L 25,18";

const TORRE_CLARA = [
  ["M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z", "stroke-linecap:butt"],
  ["M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z", "stroke-linecap:butt"],
  ["M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14", "stroke-linecap:butt"],
  ["M 34,14 L 31,17 L 14,17 L 11,14", ""],
  ["M 31,17 L 31,29.5 L 14,29.5 L 14,17", "stroke-linecap:butt;stroke-linejoin:miter"],
  ["M 31,29.5 L 32.5,32 L 12.5,32 L 14,29.5", ""],
];
const TORRE_OSCURA = [
  "M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z",
  "M 12.5,32 L 14,29.5 L 31,29.5 L 32.5,32 L 12.5,32 z",
  "M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z",
  "M 14,29.5 L 14,16.5 L 31,16.5 L 31,29.5 L 14,29.5 z",
  "M 14,16.5 L 11,14 L 34,14 L 31,16.5 L 14,16.5 z",
  "M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14 L 11,14 z",
];
const TORRE_OSCURA_LINEAS = "M 12,35.5 L 33,35.5 M 13,31.5 L 32,31.5 M 14,29.5 L 31,29.5 M 14,16.5 L 31,16.5 M 11,14 L 34,14";

const DAMA_CORONA = "M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z";
const DAMA_CUERPO =
  "M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 11,36 11,36 C 9.5,37.5 11,38.5 11,38.5 C 17.5,39.5 27.5,39.5 34,38.5 C 34,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z";
const DAMA_BOLAS = '<circle cx="6" cy="12" r="2"/><circle cx="14" cy="9" r="2"/><circle cx="22.5" cy="8" r="2"/><circle cx="31" cy="9" r="2"/><circle cx="39" cy="12" r="2"/>';

const FORMAS = {
  peon: {
    claro: `<path d="${PEON}" style="${C};${T};stroke-linejoin:miter"/>`,
    oscuro: `<path d="${PEON}" style="${O};${T};stroke-linejoin:miter"/>`,
  },
  caballo: {
    claro: `<g style="fill:none;${T}" transform="translate(0,0.3)"><path d="${CABALLO_A}" style="${C}"/><path d="${CABALLO_B}" style="${C}"/><path d="${CABALLO_OJO}" style="${O}"/><path d="${CABALLO_NARIZ}" transform="${CABALLO_NARIZ_T}" style="${O}"/></g>`,
    oscuro: `<g style="fill:none;${T}" transform="translate(0,0.3)"><path d="${CABALLO_A}" style="${O}"/><path d="${CABALLO_B}" style="${O}"/><path d="${CABALLO_OJO}" style="fill:var(--pd,#fff);stroke:var(--pd,#fff)"/><path d="${CABALLO_NARIZ}" transform="${CABALLO_NARIZ_T}" style="fill:var(--pd,#fff);stroke:var(--pd,#fff)"/><path d="${CABALLO_LUZ}" style="fill:var(--pd,#fff);stroke:none"/></g>`,
  },
  alfil: {
    claro: `<g style="fill:none;${T}" transform="translate(0,0.6)"><g style="${C};stroke-linecap:butt">${ALFIL.map((d) => `<path d="${d}"/>`).join("")}</g><path d="${ALFIL_LINEAS}" style="fill:none;stroke-linejoin:miter"/></g>`,
    oscuro: `<g style="fill:none;${T}" transform="translate(0,0.6)"><g style="${O};stroke-linecap:butt">${ALFIL.map((d) => `<path d="${d}"/>`).join("")}</g><path d="${ALFIL_LINEAS}" style="${D};stroke-linejoin:miter"/></g>`,
  },
  torre: {
    claro: `<g style="${C};${T}" transform="translate(0,0.3)">${TORRE_CLARA.map(([d, s]) => `<path d="${d}"${s ? ` style="${s}"` : ""}/>`).join("")}<path d="M 11,14 L 34,14" style="fill:none;stroke-linejoin:miter"/></g>`,
    oscuro: `<g style="${O};${T}" transform="translate(0,0.3)">${TORRE_OSCURA.map((d) => `<path d="${d}" style="stroke-linecap:butt"/>`).join("")}<path d="${TORRE_OSCURA_LINEAS}" style="${D};stroke-width:1;stroke-linejoin:miter"/></g>`,
  },
  dama: {
    claro: `<g style="${C};${T}"><path d="${DAMA_CORONA}"/><path d="${DAMA_CUERPO}"/><path d="M 11.5,30 C 15,29 30,29 33.5,30" style="fill:none"/><path d="M 12,33.5 C 18,32.5 27,32.5 33,33.5" style="fill:none"/>${DAMA_BOLAS}</g>`,
    oscuro: `<g style="${O};${T}"><path d="${DAMA_CORONA}" style="stroke-linecap:butt"/><path d="${DAMA_CUERPO}"/>${DAMA_BOLAS}<path d="M 11,38.5 A 35,35 1 0 0 34,38.5" style="fill:none;stroke-linecap:butt"/><g style="${D}"><path d="M 11,29 A 35,35 1 0 1 34,29"/><path d="M 12.5,31.5 L 32.5,31.5"/><path d="M 11.5,34.5 A 35,35 1 0 0 33.5,34.5"/><path d="M 10.5,37.5 A 35,35 1 0 0 34.5,37.5"/></g></g>`,
  },
};

/** SVG decorativo de una pieza (aria-hidden); se dimensiona con el tamaño de letra (1.2em). */
export function svgPieza(tipo, tono = "claro", clase = "") {
  const forma = FORMAS[tipo]?.[tono];
  if (!forma) throw new Error(`Pieza desconocida: ${tipo} ${tono}`);
  return `<svg class="pieza${clase ? ` ${clase}` : ""}" viewBox="0 0 45 45" width="1.2em" height="1.2em" aria-hidden="true" focusable="false">${forma}</svg>`;
}
