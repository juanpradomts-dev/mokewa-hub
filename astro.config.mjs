// @ts-check
import { defineConfig } from "astro/config";

// SITE y BASE se ajustan al publicar (p. ej. GitHub Pages: BASE=/mokewa-hub).
// OUT_DIR permite construir la copia de demostración dentro de la web oficial (dist/demo).
export default defineConfig({
  site: process.env.SITE ?? "https://juanpradomts-dev.github.io",
  base: process.env.BASE ?? "/",
  outDir: process.env.OUT_DIR ?? "./dist",
  trailingSlash: "ignore",
  build: { format: "directory" },
  devToolbar: { enabled: false },
});
