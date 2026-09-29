// Niveles de la academia: los mismos que el club usa en sus torneos híbridos (Lichess).
// «Qué aprende» es una propuesta para la demo: el club la ajusta a su programa real.
// Horario, edad sugerida y precio NO están aquí: viven en contenido.json (por confirmar).
export const NIVELES = [
  {
    id: "basico",
    nombre: "Básico",
    pieza: "♙︎",
    horario: "horario_basico",
    edad: "edad_basico",
    para: "Para quien empieza desde cero o recién aprende a mover las piezas.",
    aprende: ["Reglas, movimientos y jaque mate", "Tácticas básicas: clavada y horquilla", "Su primer torneo: reloj y reglamento"],
  },
  {
    id: "intermedio",
    nombre: "Intermedio",
    pieza: "♘︎",
    horario: "horario_intermedio",
    edad: "edad_intermedio",
    para: "Para quien ya juega y quiere empezar a competir.",
    aprende: ["Aperturas y un repertorio propio", "Combinaciones y cálculo", "Finales de torres y de peones"],
  },
  {
    id: "avanzado",
    nombre: "Avanzado",
    pieza: "♕︎",
    horario: "horario_avanzado",
    edad: "edad_avanzado",
    para: "Para quien se prepara para torneos regionales, nacionales o con rating FIDE.",
    aprende: ["Preparación contra rivales concretos", "Estrategia y planes de medio juego", "Manejo del tiempo y de la presión"],
  },
];
