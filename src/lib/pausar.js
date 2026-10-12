// Las animaciones que se repiten (caballo que flota, piezas que derivan, la luz de la línea de tiempo)
// se pausan cuando su zona no está en pantalla: ahorran batería en el celular y no cambia nada visible.
// (fixing-motion-performance: «pause looping animations when off-screen».)
// Marca el elemento con data-fuera; el CSS global pausa sus animaciones y las de sus hijos.
export function pausarFueraDeVista(el) {
  if (!el || !("IntersectionObserver" in window)) return;
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) el.removeAttribute("data-fuera");
    else el.setAttribute("data-fuera", "");
  }).observe(el);
}
