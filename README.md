# Mokewa Hub: web del Ajedrez Club Mokewa (demo funcional)

Demo de la plataforma descrita en la *Guía de desarrollo web: Ajedrez Club Mokewa* (v1.1, estrategia sorpresa).
Usa solo datos públicos verificables. Todo lo no verificado aparece como **«por confirmar»** y se edita desde el panel.

## Abrir la demo

Doble clic en **`DEMO.bat`**, o bien:

```bash
npm install
npm run dev
```

Se abre en http://localhost:4321. El panel del organizador está en `/panel/` (en la demo se entra con un botón, sin contraseña).

## Qué hay

| Página | Ruta | Datos |
|---|---|---|
| Inicio | `/` | Héroe con caballo viajero, quiénes somos (misión y visión como propuesta), academia, por qué Mokewa y cierre |
| Academia | `/academia/` | Niveles reales; horarios, precios y sede **por confirmar** |
| Torneos | `/torneos/` | Solo torneos presenciales, cada uno con foto (ilustración del club mientras no haya foto autorizada) |
| Inscripción | `/torneos/verano-2027/` | **Ejemplo** funcional: categoría automática, voucher, consentimiento del tutor |
| El Club | `/el-club/` | «Nuestra historia»: campeones de los torneos presenciales del club desde 2022, tomados de Chess-Results (`src/data/historia.json`), y comunidad en Lichess |
| Panel | `/panel/` | Inicio de sesión con roles. Administrador: todo, incluidos pagos, contactos, datos del club y personal. Entrenador: torneos, resultados y noticias. Cuentas de prueba de la demo en `src/data/personal-demo.json` |

Qué se quitó a propósito (no generaba valor para el club): Salón de la Fama, fichas de jugador, historial de torneos en línea, gráfico en línea y puzzle del día. Está en el historial de git por si se necesita.

## Datos

- `npm run datos`: descarga lo nuevo de Lichess (incremental, respeta el límite de 1 petición a la vez y espera 61 s ante un 429) y recalcula todo. Doble clic: `ACTUALIZAR-DATOS.bat`.
- `scripts/estadisticas.mjs` genera `src/data/club.json`. **Ninguna cifra está escrita a mano.**
- `npm test`: comprueba que el cálculo reproduce las cifras de la guía (758 jugadores, 85 campeones, 64 fieles, récord de 66, 644 por recuperar) y las reglas de categoría.

## Demo frente a producción

| | Demo (ahora) | Producción (tras la aprobación del club) |
|---|---|---|
| Inscripciones, vouchers y panel | En el navegador (`src/lib/store.js`: localStorage + IndexedDB) | Supabase (`src/lib/nube.js`, esquema en `supabase/migrations/`): RLS, bucket privado, roles admin/entrenador |
| Acceso al panel | Botón de demo | Supabase Auth (correo y contraseña) |
| Correo de confirmación | Se muestra en pantalla | Resend o Brevo (plan gratuito) |
| Datos de Lichess | Caché en `data/lichess/` | La misma caché, actualizada cada hora por `.github/workflows/publicar.yml` |
| Hosting | Local | GitHub Pages o Cloudflare Pages (S/ 0) |

`store.js` tiene los dos motores con la misma interfaz: sin base de datos usa el navegador; con `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY`, Supabase. Las páginas no cambian.

### Conectar la base de datos (cuando el club apruebe)

1. Con la cuenta del club, crear un proyecto gratuito en supabase.com (región São Paulo, la más cercana).
2. SQL Editor: pegar y ejecutar `supabase/migrations/20260930000000_mokewa.sql` (o `npx supabase link` y `npx supabase db push`).
3. Authentication → Sign In / Providers: desactivar el registro de usuarios nuevos. Las cuentas del panel las crea el administrador.
4. Authentication → Users → Add user (correo y contraseña del administrador). Luego, en el SQL Editor: `insert into perfiles (id, nombre, rol) values ('<id del usuario>', 'Nombre', 'admin');` (o `'entrenador'`).
5. GitHub → Settings → Secrets and variables → Actions → Variables: `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API; la clave «anon» es pública por diseño). El workflow ya las usa, y también mantiene activa la base de datos (el plan gratuito se pausa tras una semana sin uso).
6. Respaldo: la guía pide una copia semanal. No se automatiza en GitHub porque el repositorio es público y la copia tendría datos de menores: el administrador exporta cada semana desde el panel («Exportar a Excel») y lo guarda en un lugar privado del club.

Probar en local: `npx supabase start` (Docker) y `npm run prueba:nube`, que comprueba las reglas de privacidad contra la base de datos real: el público no lee datos privados, la lista pública muestra solo nombre, categoría y club, cada comprobante va en su ruta con tipo y tamaño permitidos, nadie se registra solo, el entrenador no ve contactos y el admin puede borrarlo todo.

### Web oficial y copia de prueba

El workflow construye dos versiones y las publica juntas:

- **Raíz** (`/mokewa-hub/`): la web oficial, con `PUBLIC_MODO=produccion`.
- **`/mokewa-hub/demo/`**: la copia de prueba (`PUBLIC_MODO=demo`, `OUT_DIR=dist/demo`). Tiene el aviso de demo, las propuestas marcadas, el torneo de ejemplo y el panel con cuentas de prueba. Sirve para presentar el panel y no se indexa.

La oficial no lee nada guardado en el navegador. Así, lo que alguien pruebe en `/demo/` (mismo dominio) nunca aparece en ella.

Google: la oficial lleva `noindex` hasta que se cree la variable del repositorio `PUBLIC_INDEXAR` = `si` (Settings → Secrets and variables → Actions → Variables).

### Qué cambia al construir con `PUBLIC_MODO=produccion`

- Lo no confirmado se oculta: chips «por confirmar», misión, visión y temas de cada nivel propuestos por nosotros.
- El «Torneo de Verano 2027» de ejemplo desaparece hasta que el club confirme su fecha (`verano_fecha`); entonces deja de decir «ejemplo».
- «Acerca de la demo», el panel sin base de datos y el torneo de ejemplo redirigen al instante (`src/lib/redireccion.js`, en español).
- Sin base de datos (`PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY`, ver `src/lib/backend.js`), no hay inscripción en línea ni panel: la inscripción pasa al contacto del club, para que ninguna inscripción quede guardada solo en el navegador de un padre.
- Con `PUBLIC_INDEXAR` distinto de `no` se indexa: `index, follow`, URL canónica, `robots.txt` con el sitemap, `sitemap.xml` y la ficha del club para Google (`SportsClub`, solo con datos verificados o confirmados). El panel y la página 404 nunca se indexan.

### Datos del club: del panel a la web oficial

En la reunión se cargan en el panel («Datos del club»; «Usar la propuesta» acepta nuestros textos con un clic) y la demo se actualiza al instante. Para dejarlos en la web oficial: «Descargar contenido.json», reemplazar `src/data/contenido.json`, `npm test` y commit.

## Privacidad

- `noindex` en todas las páginas y `robots.txt` con `Disallow: /` en la copia de prueba, y en la oficial mientras `PUBLIC_INDEXAR` no sea `si` (los genera `src/pages/robots.txt.ts`).
- La web no muestra nombres ni fotos de alumnos. Fotos solo con autorización escrita de los padres.
- Listas públicas: solo nombre, categoría y club (Ley N.º 29733). Los inscritos del torneo de ejemplo son nombres inventados y así se indica.

## Diseño

- Tipografía: **Archivo** (Omnibus-Type, variable, `@fontsource-variable/archivo`). Una sola familia: títulos angostos y gruesos (eje de ancho al 80 %, «MOKEWA» al 70 %), como un cartel de torneo, y texto en ancho normal. Se precarga el archivo latino (`Base.astro`).
- Paleta clara y cálida del logo: naranja `#f28a1e`, durazno, ámbar, crema y café. Sin modo oscuro: la marca no cambia.
- El caballo viajero (`src/lib/viajero.js`) nunca pasa por encima del texto y se anima para todos, también con «reducir movimiento» del sistema.

## Antes de publicar

1. El club aprueba la demo y entrega los datos de `../PREGUNTAS-PARA-EL-CLUB.md`: WhatsApp, sede, horarios, precios, autorización del logo, victorias, fotos autorizadas, entrenadores y misión y visión.
2. Si el club entrega el logo original, reemplazar el trazado (`src/components/Caballo.astro`, `public/favicon.svg`, `public/og.png`).
3. Conectar Supabase y el correo transaccional (sin ellos se puede publicar igual: la inscripción va por el contacto del club).
4. Crear la variable del repositorio `PUBLIC_INDEXAR` = `si`. Eso quita el `noindex` y activa el sitemap. La raíz ya se publica como web oficial.
5. Crear el perfil de Google Business del club con la misma dirección y el mismo teléfono de la web.
