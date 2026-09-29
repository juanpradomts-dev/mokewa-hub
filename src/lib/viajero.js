// Caballo viajero (como la botella de danlac.pe, sin librerías):
// sale del héroe y, al bajar, cruza la página girando hasta aterrizar en «Por qué Mokewa».
//
// Movimiento fluido: el scroll y el cursor solo fijan un OBJETIVO; un bucle con
// requestAnimationFrame acerca el estado actual a ese objetivo un poco en cada cuadro
// (suavizado exponencial). Así la rueda del mouse, que avanza a saltos, se ve continua.
// Lo produce el usuario al desplazarse, por eso se aplica para todos.
//
// Marcado esperado:
//   [data-viaje-desde]  caja del héroe donde nace (contiene .viajero)
//   [data-viaje-hasta]  caja donde aterriza
//   .heroe              recibe --mx, --my (cursor) y --sy (scroll) para las piezas del fondo
// Sin JavaScript, el caballo simplemente se queda en el héroe.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const SUAVE = 0.12; // fracción del camino que se recorre por cuadro (más bajo = más suave)

export function iniciarViaje() {
  const desde = document.querySelector("[data-viaje-desde]");
  const hasta = document.querySelector("[data-viaje-hasta]");
  const viajero = desde?.querySelector(".viajero");
  const moneda = viajero?.querySelector(".moneda");
  const heroe = document.querySelector(".heroe");
  if (!desde || !hasta || !viajero || !moneda) return;

  document.body.append(viajero);
  viajero.classList.add("en-viaje");

  // El caballo NUNCA pasa por encima de la información:
  // - con margen libre a la derecha (pantallas anchas) viaja por ese margen, en tamaño chico;
  // - sin margen (celular, pantallas angostas) se desvanece al salir del héroe y cae girando
  //   directo en su lugar, sin cruzar el contenido.
  const CHICO = 64;
  let cajaA, cajaB, fin, canal, xCanal;
  const medir = () => {
    const a = desde.getBoundingClientRect();
    const b = hasta.getBoundingClientRect();
    cajaA = { x: a.left + scrollX, y: a.top + scrollY, w: a.width, h: a.height };
    cajaB = { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height };
    fin = Math.max(1, cajaB.y + cajaB.h / 2 - innerHeight / 2);
    const c = document.querySelector("main .contenedor");
    const r = c.getBoundingClientRect();
    const libre = innerWidth - (r.right - parseFloat(getComputedStyle(c).paddingRight));
    canal = libre >= CHICO + 28;
    xCanal = scrollX + innerWidth - libre / 2;
    viajero.style.width = `${cajaA.w}px`;
    viajero.style.height = `${cajaA.h}px`;
  };
  const suaveMedio = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // Posición (centro en coordenadas del documento), escala y opacidad según el progreso p.
  const ruta = (p) => {
    const A = { x: cajaA.x + cajaA.w / 2, y: cajaA.y + cajaA.h / 2 };
    const B = { x: cajaB.x + cajaB.w / 2, y: cajaB.y + cajaB.h / 2 };
    const kB = cajaB.w / cajaA.w;
    const enVista = (q) => q * fin + innerHeight / 2; // centro de la pantalla cuando el progreso es q
    if (canal) {
      const kC = CHICO / cajaA.w;
      const P1 = 0.18, P2 = 0.82;
      if (p <= P1) {
        const t = suaveMedio(p / P1);
        return { x: lerp(A.x, xCanal, t), y: lerp(A.y, enVista(P1), t), k: lerp(1, kC, t), o: 1 };
      }
      if (p < P2) return { x: xCanal, y: enVista(p), k: kC, o: 1 };
      // Baja por el margen y solo en el último tramo entra hacia su lugar (sin rozar tarjetas).
      const t = (p - P2) / (1 - P2);
      const tx = suaveMedio(clamp((t - 0.55) / 0.45, 0, 1));
      return { x: lerp(xCanal, B.x, tx), y: lerp(enVista(P2), B.y, suaveMedio(t)), k: lerp(kC, kB, tx), o: 1 };
    }
    if (p <= 0.25) {
      const t = suaveMedio(p / 0.25);
      return { x: A.x, y: A.y - 40 * t, k: lerp(1, 0.5, t), o: 1 - t };
    }
    if (p < 0.8) return { x: B.x, y: B.y, k: kB, o: 0 };
    const t = suaveMedio((p - 0.8) / 0.2);
    return { x: B.x, y: B.y - 70 * (1 - t), k: lerp(kB * 0.4, kB, t), o: t };
  };

  // Estado actual y objetivo (progreso del viaje, inclinación por cursor, parallax del fondo).
  const actual = { p: 0, rx: 0, ry: 0, mx: 0, my: 0 };
  const objetivo = { p: 0, rx: 0, ry: 0, mx: 0, my: 0 };

  const pintar = () => {
    const p = actual.p;
    const { x, y, k, o } = ruta(p);
    // El escalado parte de la esquina superior izquierda: se compensa para centrar en (x, y).
    viajero.style.transform = `translate3d(${x - (cajaA.w * k) / 2}px, ${y - (cajaA.h * k) / 2}px, 0) scale(${k})`;
    viajero.style.opacity = o.toFixed(3);
    viajero.style.visibility = o < 0.01 ? "hidden" : "visible";
    moneda.style.setProperty("--giro", `${p * (canal ? 720 : 360)}deg`);
    moneda.style.setProperty("--inclina", `${Math.sin(p * Math.PI) * -16}deg`);
    moneda.style.setProperty("--rx", `${actual.rx.toFixed(2)}deg`);
    moneda.style.setProperty("--ry", `${actual.ry.toFixed(2)}deg`);
    desde.style.setProperty("--salida", String(1 - clamp(p * 3, 0, 1)));
    hasta.classList.toggle("aterrizado", p > 0.985);
    if (heroe && scrollY < innerHeight * 1.5) {
      heroe.style.setProperty("--mx", actual.mx.toFixed(3));
      heroe.style.setProperty("--my", actual.my.toFixed(3));
      heroe.style.setProperty("--sy", String(Math.round(scrollY)));
    }
  };

  let enMarcha = false;
  const cuadro = () => {
    let quieto = true;
    for (const k of Object.keys(actual)) {
      const d = objetivo[k] - actual[k];
      if (Math.abs(d) > 0.0004) {
        actual[k] += d * SUAVE;
        quieto = false;
      } else actual[k] = objetivo[k];
    }
    pintar();
    if (quieto) enMarcha = false;
    else requestAnimationFrame(cuadro);
  };
  const mover = () => {
    if (!enMarcha) {
      enMarcha = true;
      requestAnimationFrame(cuadro);
    }
  };
  const alDesplazar = () => {
    objetivo.p = clamp(scrollY / fin, 0, 1);
    mover();
  };

  medir();
  actual.p = objetivo.p = clamp(scrollY / fin, 0, 1); // al cargar a mitad de página, sin viaje inicial
  pintar();
  addEventListener("scroll", alDesplazar, { passive: true });
  addEventListener("resize", () => {
    medir();
    alDesplazar();
  });
  new ResizeObserver(() => {
    medir();
    alDesplazar();
  }).observe(document.body);

  // Cursor: inclina la moneda y mueve las piezas del fondo (solo con mouse).
  if (matchMedia("(pointer: fine)").matches) {
    addEventListener("pointermove", (ev) => {
      const r = viajero.getBoundingClientRect();
      objetivo.ry = clamp((ev.clientX - (r.left + r.width / 2)) / innerWidth, -0.5, 0.5) * 30;
      objetivo.rx = clamp((ev.clientY - (r.top + r.height / 2)) / innerHeight, -0.5, 0.5) * -20;
      objetivo.mx = ev.clientX / innerWidth - 0.5;
      objetivo.my = ev.clientY / innerHeight - 0.5;
      mover();
    });
  }
}
