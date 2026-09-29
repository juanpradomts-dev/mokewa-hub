// Niveles de la academia: los mismos que el club usa en sus torneos híbridos (Lichess).
// Qué aprende, horario, edad sugerida y precio NO están aquí: viven en contenido.json
// (campos aprende_*, horario_*, edad_*, precio_mensual) y se confirman desde el panel.
export const NIVELES = [
  {
    id: "basico",
    nombre: "Básico",
    pieza: "♙︎",
    horario: "horario_basico",
    edad: "edad_basico",
    para: "Para quien empieza desde cero o recién aprende a mover las piezas.",
  },
  {
    id: "intermedio",
    nombre: "Intermedio",
    pieza: "♘︎",
    horario: "horario_intermedio",
    edad: "edad_intermedio",
    para: "Para quien ya juega y quiere empezar a competir.",
  },
  {
    id: "avanzado",
    nombre: "Avanzado",
    pieza: "♕︎",
    horario: "horario_avanzado",
    edad: "edad_avanzado",
    para: "Para quien se prepara para torneos regionales, nacionales o con rating FIDE.",
  },
];
