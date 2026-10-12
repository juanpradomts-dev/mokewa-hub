// Preguntas frecuentes de las familias, por tema. Las usan Academia (todas) y el inicio (las 4 que más
// pesan al decidir). Solo respuestas verificadas: si falta un dato del club (edad, precio), la respuesta
// invita a pedirlo en vez de inventarlo o de mostrar «por confirmar».
import club from "../data/club.json";
import { valor, esProduccion } from "./contenido.js";
import { hayBaseDeDatos } from "./backend.js";

/** @param {string} b  BASE_URL sin la barra final */
export function gruposFaq(b) {
  const contacto = { href: `${b}/contacto/`, texto: "Ir a contacto" };
  const enLinea = !esProduccion || hayBaseDeDatos;
  const edad = valor("edad_minima");
  const precio = valor("precio_mensual");
  const sede = valor("sede");
  const mapa = valor("mapa");
  return [
    {
      titulo: "Clases",
      preguntas: [
        { id: "saber-jugar", p: "¿Hace falta saber jugar para empezar?", r: "No. Básico es para quien empieza desde cero o recién aprende a mover las piezas." },
        { id: "por-donde", p: "¿Cómo sé por dónde empezar?", r: "Si nunca ha jugado, por básico. Si ya juega o compite, cuéntanos su experiencia y el club te recomienda dónde empezar." },
        edad
          ? { id: "edad", p: "¿Desde qué edad pueden empezar?", r: `Desde ${edad}.` }
          : { id: "edad", p: "¿Desde qué edad pueden empezar?", r: "Cuéntanos la edad de tu hijo o hija y te decimos con qué grupo empezaría.", enlace: contacto },
        precio
          ? { id: "precio", p: "¿Cuánto cuesta y cuáles son los horarios?", r: `Mensualidad: ${precio}. Los horarios de cada grupo están en sus tarjetas.` }
          : { id: "precio", p: "¿Cuánto cuesta y cuáles son los horarios?", r: "Pídenos los horarios y precios vigentes y te los enviamos.", enlace: contacto },
        ...(sede ? [{ id: "donde", p: "¿Dónde queda el club?", r: `En ${sede}.`, enlace: mapa ? { href: mapa, texto: "Ver en Google Maps", externo: true } : undefined }] : []),
        { id: "en-casa", p: "¿Se puede practicar en casa?", r: "Sí: el club tiene un equipo gratuito en Lichess donde se juegan torneos en línea desde el celular.", enlace: { href: club.equipo.url, texto: "Equipo en Lichess", externo: true } },
      ],
    },
    {
      titulo: "Torneos",
      preguntas: [
        { id: "torneos", p: "¿Hay torneos para alumnos?", r: "Sí: torneos presenciales a lo largo del año, también oficiales con rating FIDE." },
        { id: "enterarme", p: "¿Cómo me entero de los próximos torneos?", r: "Se anuncian en la página Torneos de esta web y en el Facebook del club.", enlace: { href: `${b}/torneos/`, texto: "Ver torneos" } },
        enLinea
          ? { id: "inscribir", p: "¿Cómo se inscribe a un torneo?", r: "En línea, desde la página de cada torneo: la categoría se calcula sola con la fecha de nacimiento." }
          : { id: "inscribir", p: "¿Cómo se inscribe a un torneo?", r: "Pídenos las bases del torneo y te enviamos los pasos para inscribirte.", enlace: contacto },
        { id: "fide", p: "¿Qué es el rating FIDE?", r: "Es la puntuación internacional de la Federación Internacional de Ajedrez. Se obtiene jugando torneos oficiales, como los que el club organiza con rating FIDE." },
      ],
    },
    {
      titulo: "Familias",
      preguntas: [
        { id: "fotos", p: "¿Publican nombres o fotos de los alumnos?", r: "Solo de los campeones de cada torneo, con el nombre y la inicial del apellido. Fotos de menores, solo con autorización escrita del padre, madre o tutor.", enlace: { href: `${b}/privacidad/`, texto: "Cómo cuidamos los datos" } },
        { id: "retirar", p: "¿Puedo pedir que retiren un nombre?", r: "Sí. Pídelo y se retira de «Nuestra historia»; en la web queda solo la categoría.", enlace: contacto },
      ],
    },
  ];
}

// Las 4 que más pesan cuando una familia decide (FORMULA-GANADORA.md, N6): empezar, edad, precio y seguridad.
export const DESTACADAS = ["saber-jugar", "edad", "precio", "fotos"];
