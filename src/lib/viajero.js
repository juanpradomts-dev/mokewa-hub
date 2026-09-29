// Caballo viajero (como la botella de danlac.pe, sin librerías):
// sale del héroe y, al bajar, cruza la página girando hasta aterrizar en la sección «Por qué Mokewa».
// El movimiento lo produce el scroll del usuario (no se mueve solo), así que se aplica para todos.
//
// Marcado esperado:
//   [data-viaje-desde]  caja del héroe donde nace (contiene .viajero)
//   [data-viaje-hasta]  caja donde aterriza
// Sin JavaScript, el caballo simplemente se queda en el héroe.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

export function iniciarViaje() {
  const desde = document.querySelector("[data-viaje-desde]");
  const hasta = document.querySelector("[data-viaje-hasta]");
  const viajero = desde?.querySelector(".viajero");
  const moneda = viajero?.querySelector(".moneda");
  if (!desde || !hasta || !viajero || !moneda) return;

  // El viajero pasa a una capa propia, posicionada en coordenadas del documento.
  document.body.append(viajero);
  viajero.classList.add("en-viaje");

  let cajaA, cajaB, fin;
  const medir = () => {
    const a = desde.getBoundingClientRect();
    const b = hasta.getBoundingClientRect();
    cajaA = { x: a.left + scrollX, y: a.top + scrollY, w: a.width, h: a.height };
    cajaB = { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height };
    // El viaje termina cuando el punto de aterrizaje queda en el centro de la pantalla.
    fin = Math.max(1, cajaB.y + cajaB.h / 2 - innerHeight / 2);
    viajero.style.width = `${cajaA.w}px`;
    viajero.style.height = `${cajaA.h}px`;
  };

  let pendiente = false;
  const pintar = () => {
    pendiente = false;
    const p = clamp(scrollY / fin, 0, 1);
    // Avance lineal: así el caballo acompaña la vista durante todo el viaje (no se queda atrás).
    const e = p;
    const cx = lerp(cajaA.x + cajaA.w / 2, cajaB.x + cajaB.w / 2, e);
    const cy = lerp(cajaA.y + cajaA.h / 2, cajaB.y + cajaB.h / 2, e);
    const escala = lerp(1, cajaB.w / cajaA.w, e);
    // El escalado parte de la esquina superior izquierda: se compensa para que el centro quede en (cx, cy).
    viajero.style.transform = `translate3d(${cx - (cajaA.w * escala) / 2}px, ${cy - (cajaA.h * escala) / 2}px, 0) scale(${escala})`;
    // Una vuelta completa (se ve el dorso a mitad de camino) y un balanceo que se apaga al llegar.
    moneda.style.setProperty("--giro", `${e * 360}deg`);
    moneda.style.setProperty("--inclina", `${Math.sin(p * Math.PI) * -16}deg`);
    desde.style.setProperty("--salida", String(1 - clamp(p * 3, 0, 1)));
    hasta.classList.toggle("aterrizado", p > 0.985);
    viajero.classList.toggle("volando", p > 0.02 && p < 0.985);
  };
  const pedir = () => {
    if (!pendiente) {
      pendiente = true;
      requestAnimationFrame(pintar);
    }
  };

  medir();
  pintar();
  addEventListener("scroll", pedir, { passive: true });
  addEventListener("resize", () => {
    medir();
    pedir();
  });
  // Fuentes, imágenes o datos que llegan después cambian las alturas: se vuelve a medir.
  new ResizeObserver(() => {
    medir();
    pedir();
  }).observe(document.body);

  // Inclinación hacia el cursor (responde al usuario).
  if (matchMedia("(pointer: fine)").matches) {
    addEventListener("pointermove", (ev) => {
      const r = viajero.getBoundingClientRect();
      const x = clamp((ev.clientX - (r.left + r.width / 2)) / innerWidth, -0.5, 0.5);
      const y = clamp((ev.clientY - (r.top + r.height / 2)) / innerHeight, -0.5, 0.5);
      moneda.style.setProperty("--ry", `${(x * 30).toFixed(1)}deg`);
      moneda.style.setProperty("--rx", `${(-y * 20).toFixed(1)}deg`);
    });
  }
}
