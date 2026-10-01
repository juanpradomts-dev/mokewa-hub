// Canales del club con su ícono. Los fijos (Facebook, Lichess) siempre están; los demás aparecen
// cuando el club carga su dato (panel o contenido.json). Íconos propios en SVG, sin librerías.
import { FACEBOOK, correoValido, enlaceGmail, numeroWhatsapp } from "./contacto.js";

const MENSAJE = "Hola, quisiera información sobre el Ajedrez Club Mokewa.";

export const ICONOS = {
  correo: '<path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" d="M3 5.5h18v13H3z M3.5 6l8.5 7 8.5-7"/>',
  whatsapp:
    '<path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7c.1.2 1.9 2.9 4.6 4 1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.4-.3Z"/>',
  facebook:
    '<path fill="currentColor" d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.5 1.6-1.5h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.3H7.5V14h2.7v8h3.3Z"/>',
  instagram:
    '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="17.4" cy="6.6" r="1.2" fill="currentColor"/>',
  tiktok:
    '<path fill="currentColor" d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.2v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.6a5.8 5.8 0 1 0 5 5.8V9.1a7.4 7.4 0 0 0 4.3 1.4V7.3a4.3 4.3 0 0 1-3.2-1.5Z"/>',
  youtube:
    '<path fill="currentColor" d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z"/>',
  lichess:
    '<path fill="currentColor" d="M7 21h11v-2.2H7V21Zm1.4-3.6h8.4c-.3-2.6-1.6-4.4-1.6-6.9 1.5.9 2.8.7 3.6-.3L17 7.6C15.8 5.2 13.5 3.8 11 3.8L9.9 2 8.6 4.4C6.3 5.7 5 8 5 10.8l2.5 1.4 1.6-1.3c.3 2.5-.8 4.1-.7 6.5Zm2.4-10.3a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Z"/>',
  mapa: '<path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/>',
  reloj: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 7v5.2l3.4 2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
};

const urlSegura = (v) => (/^https:\/\//.test(String(v ?? "").trim()) ? String(v).trim() : null);

/**
 * Canales en orden. `campo` = dato del club que lo activa (null = fijo). `enlace(valor)` arma el href.
 * @param {(campo: string) => string | null} valor  lector del contenido (build o navegador)
 * @param {string} lichess  URL del equipo en Lichess
 */
export function canales(valor, lichess) {
  return [
    { id: "correo", nombre: "Gmail", campo: "correo", href: correoValido(valor("correo")) && enlaceGmail(correoValido(valor("correo")), "Consulta · Ajedrez Club Mokewa", MENSAJE) },
    { id: "whatsapp", nombre: "WhatsApp", campo: "whatsapp", href: numeroWhatsapp(valor("whatsapp")) && `https://wa.me/${numeroWhatsapp(valor("whatsapp"))}?text=${encodeURIComponent(MENSAJE)}` },
    { id: "facebook", nombre: "Facebook", campo: null, href: FACEBOOK },
    { id: "instagram", nombre: "Instagram", campo: "instagram", href: urlSegura(valor("instagram")) },
    { id: "tiktok", nombre: "TikTok", campo: "tiktok", href: urlSegura(valor("tiktok")) },
    { id: "youtube", nombre: "YouTube", campo: "youtube", href: urlSegura(valor("youtube")) },
    { id: "lichess", nombre: "Lichess", campo: null, href: lichess },
  ];
}
