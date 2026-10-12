---
version: alpha
name: Ajedrez Club Mokewa
description: "Web del Ajedrez Club Mokewa (Moquegua): academia de ajedrez, torneos presenciales y la historia de sus campeones."
colors:
  oro: "#f28a1e"
  ambar: "#f7a54a"
  vino: "#a64b08"
  vino-osc: "#5a2a06"
  durazno: "#fde7d1"
  crema: "#fff4e8"
  fondo: "#fdf8f2"
  papel: "#ffffff"
  casilla: "#f8ece0"
  linea: "#eadfd1"
  tinta: "#1a1714"
  suave: "#5f5850"
  ok: "#1e6b43"
  ok-fondo: "#e3f3e9"
  error: "#a1261b"
  error-fondo: "#fbe7e4"
  pc-fondo: "#fff1c7"
  pc-texto: "#6f4400"
typography:
  titulo:
    fontFamily: Archivo Variable
    fontWeight: 780
    lineHeight: 1.05
  sans:
    fontFamily: Archivo Variable
    fontSize: 17px
    lineHeight: 1.6
rounded:
  base: 16px
---

## Overview

Web de un club de ajedrez para familias que buscan clases y para jugadores que buscan torneos. Lo primero es que una familia entienda en segundos qué ofrece el club, cómo empezar y cómo escribir; después, darle motivos para volver (próximo torneo, resultados, campeones). Funciona igual de bien en un celular modesto: sin frameworks, rápida y accesible (WCAG AA).

## Colors

El naranja de marca (`oro`) y la tinta casi negra son la base; los cremas y durazno dan calidez a los fondos. `vino` es el naranja quemado para enlaces y textos de acento, porque cumple contraste AA sobre crema y durazno; `oro` no se usa para texto sobre fondos claros. `vino-osc` es el café del pie y de las bandas oscuras, en lugar de negro puro.

La portada es de noche: café casi negro con brillo naranja y un tablero en perspectiva; sobre ella, los textos van en tonos claros y MOKEWA en `oro`.

Los colores `pc-*` marcan solo en la demo lo que el club aún no confirmó. La paleta es siempre clara (la marca no cambia con el modo oscuro del sistema).

## Typography

Una sola familia variable, Archivo. Los títulos van angostos (eje de ancho al 80 %) y gruesos, como un cartel de torneo; el texto corrido, en ancho normal. Las cifras de datos usan números tabulares. Los títulos se equilibran (`text-wrap: balance`) y los párrafos evitan palabras sueltas al final (`pretty`), con líneas de 70 caracteres como máximo.

## Layout

Celular primero. El contenido se centra en un contenedor de 1120 px como máximo. Toda zona que se toca mide al menos 44 px. El botón flotante de WhatsApp está siempre presente: nada importante debe quedar debajo de él.

## Shapes

Las tarjetas y superficies usan el radio `base`; los botones y etiquetas son píldoras. Las piezas de ajedrez son SVG (set Cburnett, licencia BSD), nunca símbolos Unicode ni emoji. La casilla de tablero (cuadros alternos) es el motivo de la marca: aparece en la portada, en las casillas de cada nivel de la academia y en las viñetas.

## Components

- **Nivel de la academia:** la pieza del nivel sobre su casilla; el tablero se oscurece de básico a avanzado (peón blanco, caballo blanco, dama dorada).
- **Marcador:** las cifras del club en forma de reloj de ajedrez.
- **Botón de contacto:** un solo botón principal por sección, que abre el canal real del club.

## Do's and Don'ts

- Nunca inventar datos del club (horarios, precios, entrenadores, testimonios, fotos). Lo no confirmado se oculta en la web oficial y se marca «por confirmar» en la demo.
- De los campeones, solo el nombre y la inicial del apellido. Fotos de menores solo con autorización escrita del padre, madre o tutor.
- Los fundidos y los movimientos que responden a un clic van para todos, también con «reducir animaciones» del sistema; las animaciones que se repiten se pausan fuera de la vista.
- Sin React, Bootstrap, Tailwind ni otro framework.
- Sin bordes laterales de color en tarjetas y avisos, ni signos de exclamación en las confirmaciones.
