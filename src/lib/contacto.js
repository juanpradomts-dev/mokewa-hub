// Enlaces de contacto honestos: solo se habla de WhatsApp cuando el club cargó su número.
// Mientras tanto, los botones dicen «Escríbenos» y abren la página de Facebook (el único canal verificado).

export const FACEBOOK = "https://www.facebook.com/ACMokewa/";

// Normaliza un celular peruano: 9 dígitos que empiezan con 9, con o sin 51 delante.
export function numeroWhatsapp(valor) {
  const n = String(valor ?? "").replace(/\D/g, "");
  if (!/^(51)?9\d{8}$/.test(n)) return null;
  return n.length === 9 ? `51${n}` : n;
}

/**
 * @param {string|null} whatsapp  número tal como está en contenido.json (o null)
 * @param {string} mensaje        texto prellenado para WhatsApp
 * @param {string} [accion]       texto fijo del botón («Consultar horario»); sin él se usa «Escríbenos»
 */
export function enlaceContacto(whatsapp, mensaje = "", accion = "") {
  const numero = numeroWhatsapp(whatsapp);
  if (numero) {
    const texto = accion || "Escríbenos por WhatsApp";
    return {
      tipo: "whatsapp",
      href: `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`,
      texto,
      aria: accion ? `${accion} por WhatsApp` : texto,
    };
  }
  const texto = accion || "Escríbenos";
  return { tipo: "facebook", href: FACEBOOK, texto, aria: `${texto} (abre la página de Facebook del club)` };
}
