// El próximo torneo para el inicio: el más cercano con fecha de hoy en adelante, entre los creados en el
// panel. Si no hay ninguno y el club confirmó la fecha del Torneo de Verano, ese. Si no, nada.
// (Se prueba en tests/proximo.test.mjs.)

const isoHoy = (hoy) => {
  const d = new Date(hoy);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function proximoTorneo(torneos, { veranoFecha = null, hoy = new Date() } = {}) {
  const desde = isoHoy(hoy);
  const conFecha = torneos
    .filter((t) => !t.ejemplo && t.modalidad !== "Online" && /^\d{4}-\d{2}-\d{2}$/.test(t.fecha ?? "") && t.fecha >= desde)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (conFecha.length) return { ...conFecha[0], fechaIso: conFecha[0].fecha };
  const verano = torneos.find((t) => t.id === "verano-2027");
  if (verano && veranoFecha) {
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(veranoFecha) ? veranoFecha : null;
    if (iso && iso < desde) return null; // ya pasó
    return { ...verano, fechaIso: iso, fechaTexto: iso ? "" : veranoFecha };
  }
  return null;
}
