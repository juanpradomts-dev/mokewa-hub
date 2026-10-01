// Google Maps de la sede: del enlace que carga el club (campo «mapa») sale el lugar que se muestra en
// el mapa incrustado y el destino de «Cómo llegar». Acepta enlaces de búsqueda (?query= o ?q=), de
// lugar (/place/Nombre) o con coordenadas (@lat,lng). Sin enlace, usa la dirección de la sede.

export function lugarDelMapa(mapa, sede) {
  try {
    const u = new URL(String(mapa ?? ""));
    const q = u.searchParams.get("query") || u.searchParams.get("q");
    if (q) return q;
    const coords = u.href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coords) return `${coords[1]},${coords[2]}`;
    const lugar = u.pathname.match(/\/place\/([^/]+)/);
    if (lugar) return decodeURIComponent(lugar[1].replace(/\+/g, " "));
  } catch {}
  return sede ? `${sede}, Perú` : null;
}

// Mapa incrustable sin clave de API (el que Google ofrece en «Compartir → Insertar un mapa»).
export const mapaIncrustado = (lugar) => `https://maps.google.com/maps?q=${encodeURIComponent(lugar)}&z=16&output=embed`;

// Abre Google Maps con la ruta desde donde esté la persona hasta el club.
export const comoLlegar = (lugar) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lugar)}`;
