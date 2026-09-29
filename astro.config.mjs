// @ts-check
import { defineConfig } from "astro/config";

// SITE y BASE se ajustan al publicar (p. ej. GitHub Pages: BASE=/mokewa-hub).
export default defineConfig({
  site: process.env.SITE ?? "https://mokewa.example",
  base: process.env.BASE ?? "/",
  trailingSlash: "ignore",
  build: { format: "directory" },
  devToolbar: { enabled: false },
});
