// Escapa texto antes de insertarlo como HTML (todo lo que escribe un usuario pasa por aquí).
const MAPA = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => MAPA[c]);
