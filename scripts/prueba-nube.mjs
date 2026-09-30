// Corre tests/nube.integracion.mjs contra el Supabase local («npx supabase start» antes).
// Toma la URL y las claves de «supabase status»; nunca se guardan en el repositorio.
import { execSync, spawnSync } from "node:child_process";

const CLI = "npx -y supabase@2.118.0";
const salida = execSync(`${CLI} status -o env`, { encoding: "utf8" });
const env = Object.fromEntries(
  salida
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const r = spawnSync(process.execPath, ["--test", "tests/nube.integracion.mjs"], {
  stdio: "inherit",
  env: {
    ...process.env,
    SUPABASE_URL: env.API_URL,
    SUPABASE_ANON_KEY: env.ANON_KEY ?? env.PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: env.SERVICE_ROLE_KEY ?? env.SECRET_KEY,
  },
});
process.exit(r.status ?? 1);
