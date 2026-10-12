// CSV para Excel: separador «;», BOM para las tildes y celdas a salvo de la inyección de fórmulas.
// Un texto que empieza con = + - @ (o tabulador / retorno) Excel lo ejecuta como fórmula al abrir el
// archivo; esos datos los escriben visitantes (inscripciones), así que se anteponen con «'».
const PELIGRO = /^[=+\-@\t\r]/;
export function celda(valor) {
  let t = String(valor ?? "");
  if (PELIGRO.test(t) && !/^-?\d+([.,]\d+)?$/.test(t)) t = `'${t}`; // los números negativos quedan igual
  return `"${t.replace(/"/g, '""')}"`;
}
export const csv = (filas) => "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n");
