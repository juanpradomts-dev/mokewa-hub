// Datos editables del club (src/data/contenido.json) y modo de la web.
// PUBLIC_MODO=produccion → lo no confirmado se oculta; en demo se ve un chip discreto «por confirmar».
import contenido from "../data/contenido.json" with { type: "json" };

export const MODO = globalThis.process?.env?.PUBLIC_MODO === "produccion" || import.meta.env?.PUBLIC_MODO === "produccion" ? "produccion" : "demo";
export const esProduccion = MODO === "produccion";

export function valor(campo) {
  const v = contenido.campos[campo]?.valor;
  return v != null && String(v).trim() !== "" ? String(v).trim() : null;
}

// Listas escritas en un solo campo, separadas por «;» o saltos de línea (entrenadores, fotos).
export const lista = (campo) =>
  (valor(campo) ?? "")
    .split(/[;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
