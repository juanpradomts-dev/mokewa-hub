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
| El Club | `/el-club/` | «Nuestra historia»: logros en torneos presenciales (`src/data/historia.json`) y comunidad en Lichess |
| Panel | `/panel/` | Validar pagos, exportar CSV, crear torneos, publicar resultados y noticias, editar datos del club |

Qué se quitó a propósito (no generaba valor para el club): Salón de la Fama, fichas de jugador, historial de torneos en línea, gráfico en línea y puzzle del día. Está en el historial de git por si se necesita.

## Datos

- `npm run datos`: descarga lo nuevo de Lichess (incremental, respeta el límite de 1 petición a la vez y espera 61 s ante un 429) y recalcula todo. Doble clic: `ACTUALIZAR-DATOS.bat`.
- `scripts/estadisticas.mjs` genera `src/data/club.json`. **Ninguna cifra está escrita a mano.**
- `npm test`: comprueba que el cálculo reproduce las cifras de la guía (758 jugadores, 85 campeones, 64 fieles, récord de 66, 644 por recuperar) y las reglas de categoría.

## Demo frente a producción

| | Demo (ahora) | Producción (tras la aprobación del club) |
|---|---|---|
| Inscripciones, vouchers y panel | En el navegador (`src/lib/store.js`: localStorage + IndexedDB) | Supabase: `supabase/schema.sql` (RLS, bucket privado, roles admin/entrenador) |
| Acceso al panel | Botón de demo | Supabase Auth (correo y contraseña) |
| Correo de confirmación | Se muestra en pantalla | Resend o Brevo (plan gratuito) |
| Datos de Lichess | Caché en `data/lichess/` | La misma caché, actualizada cada hora por `.github/workflows/publicar.yml` |
| Hosting | Local | GitHub Pages o Cloudflare Pages (S/ 0) |

Para migrar: cambiar la implementación de las funciones de `store.js` por llamadas a Supabase; las páginas no cambian.

## Privacidad

- `noindex` en todas las páginas y `robots.txt` con `Disallow: /` mientras sea demo.
- Solo usuarios públicos de Lichess: ningún nombre real ni foto.
- Listas públicas: solo nombre, categoría y club (Ley N.º 29733).

## Antes de publicar

1. El club aprueba y entrega los cinco datos: horarios, precios, sede, WhatsApp oficial y autorización del logo.
2. Reemplazar el logo provisional (`src/components/Logo.astro`, `public/favicon.svg`).
3. Conectar Supabase y el correo transaccional.
4. Quitar `noindex` (`src/layouts/Base.astro`) y `robots.txt`, añadir el sitemap y crear el perfil de Google Business.
