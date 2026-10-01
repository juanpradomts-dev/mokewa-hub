// Niveles de la academia: los mismos que el club usa en sus torneos híbridos (Lichess).
// Qué aprende, horario, edad sugerida y precio NO están aquí: viven en contenido.json
// (campos aprende_*, horario_*, edad_*, precio_mensual) y se confirman desde el panel.
export const NIVELES = [
  {
    id: "basico",
    nombre: "Básico",
    pieza: "peon", // ícono SVG (src/lib/piezas.js)
    horario: "horario_basico",
    edad: "edad_basico",
    para: "Para quien empieza desde cero o recién aprende a mover las piezas.",
    accion: "Quiero empezar", // texto del botón: cada tarjeta dice algo distinto
  },
  {
    id: "intermedio",
    nombre: "Intermedio",
    pieza: "caballo",
    horario: "horario_intermedio",
    edad: "edad_intermedio",
    para: "Para quien ya juega y quiere empezar a competir.",
    accion: "Quiero competir", // texto del botón: cada tarjeta dice algo distinto
  },
  {
    id: "avanzado",
    nombre: "Avanzado",
    pieza: "dama",
    horario: "horario_avanzado",
    edad: "edad_avanzado",
    para: "Para quien se prepara para torneos regionales, nacionales o con rating FIDE.",
    accion: "Quiero ir por el podio", // texto del botón: cada tarjeta dice algo distinto
  },
];
