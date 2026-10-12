// Conteo anónimo de visitas (src/lib/conteo.js): qué se cuenta y con qué nombre de página.
import { test } from "node:test";
import assert from "node:assert/strict";
import { paginaDe, eventoDeEnlace } from "../src/lib/conteo.js";

test("paginaDe: misma página en la demo y en la oficial, sin datos de la dirección", () => {
  assert.equal(paginaDe("/mokewa-hub/academia/", "/mokewa-hub"), "/academia/");
  assert.equal(paginaDe("/mokewa-hub/demo/torneos/torneo/", "/mokewa-hub/demo"), "/torneos/torneo/");
  assert.equal(paginaDe("/mokewa-hub/", "/mokewa-hub"), "/");
  assert.equal(paginaDe("/Contacto/index.html"), "/contacto/");
  assert.equal(paginaDe("/página rara/%3Cscript%3E"), "/otra/");
});

test("eventoDeEnlace: reconoce los canales de contacto y nada más", () => {
  assert.equal(eventoDeEnlace("https://wa.me/51900000000?text=Hola"), "whatsapp");
  assert.equal(eventoDeEnlace("mailto:club@example.com"), "correo");
  assert.equal(eventoDeEnlace("https://www.facebook.com/club"), "facebook");
  assert.equal(eventoDeEnlace("https://m.me/club"), "facebook");
  assert.equal(eventoDeEnlace("https://www.google.com/maps/dir/?api=1&destination=Moquegua"), "como_llegar");
  assert.equal(eventoDeEnlace("https://lichess.org/team/x"), null);
  assert.equal(eventoDeEnlace("/academia/"), null);
});

import { celda, csv } from "../src/lib/csv.js";

test("csv: lo que escribe un visitante no se ejecuta como fórmula al abrirlo en Excel", () => {
  assert.equal(celda('=HYPERLINK("http://x","clic")'), `"'=HYPERLINK(""http://x"",""clic"")"`);
  assert.equal(celda("+51 999"), `"'+51 999"`);
  assert.equal(celda("@SUM(A1)"), `"'@SUM(A1)"`);
  assert.equal(celda("-12.5"), `"-12.5"`, "un número negativo queda igual");
  assert.equal(celda("Quispe Mamani"), `"Quispe Mamani"`);
  assert.ok(csv([["a", "b"]]).startsWith("﻿"), "BOM para las tildes");
});
