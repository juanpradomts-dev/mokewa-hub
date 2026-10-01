// Enlaces de contacto honestos. El canal principal es el correo del club (Gmail): cuando está cargado,
// todos los botones de contacto abren Gmail con el mensaje escrito. Si falta, WhatsApp (solo con número
// cargado) y, si tampoco, la página de Facebook, el único canal verificado hoy.

export const FACEBOOK = "https://www.facebook.com/ACMokewa/";

// Normaliza un celular peruano: 9 dígitos que empiezan con 9, con o sin 51 delante.
export function numeroWhatsapp(valor) {
  const n = String(valor ?? "").replace(/\D/g, "");
  if (!/^(51)?9\d{8}$/.test(n)) return null;
  return n.length === 9 ? `51${n}` : n;
}

export function correoValido(valor) {
  const c = String(valor ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) ? c : null;
}

// Redacción de Gmail en el navegador (en el celular abre la app o la web de Gmail).
export const enlaceGmail = (correo, asunto, mensaje) =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(correo)}&su=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`;

/**
 * @param {string|null|{correo?: string|null, whatsapp?: string|null}} canales  WhatsApp (texto) o {correo, whatsapp}
 * @param {string} mensaje   texto prellenado
 * @param {string} [accion]  texto fijo del botón («Pide informes»); sin él, uno según el canal
 */
export function enlaceContacto(canales, mensaje = "", accion = "") {
  const { correo, whatsapp } = typeof canales === "object" && canales !== null ? canales : { whatsapp: canales };
  const email = correoValido(correo);
  if (email) {
    const gmail = email.endsWith("@gmail.com");
    const texto = accion || "Enviar correo";
    const asunto = `${accion || "Consulta"} · Ajedrez Club Mokewa`;
    return {
      tipo: "correo",
      href: enlaceGmail(email, asunto, mensaje),
      texto,
      aria: `${texto} (abre ${gmail ? "Gmail" : "el correo"} con el mensaje escrito)`,
    };
  }
  const numero = numeroWhatsapp(whatsapp);
  if (numero) {
    const texto = accion || "Abrir WhatsApp";
    return {
      tipo: "whatsapp",
      href: `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`,
      texto,
      aria: accion ? `${accion} por WhatsApp` : texto,
    };
  }
  const texto = accion || "Enviar mensaje";
  return { tipo: "facebook", href: FACEBOOK, texto, aria: `${texto} (abre la página de Facebook del club)` };
}
