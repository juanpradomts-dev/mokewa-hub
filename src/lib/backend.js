// ¿Hay base de datos conectada? En producción la inscripción en línea y el panel dependen de ella
// (Supabase: supabase/schema.sql). Se activa definiendo PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY
// al construir. Sin ella, la web oficial funciona igual y deriva las inscripciones al contacto del club.
const url = globalThis.process?.env?.PUBLIC_SUPABASE_URL ?? import.meta.env?.PUBLIC_SUPABASE_URL;
const clave = globalThis.process?.env?.PUBLIC_SUPABASE_ANON_KEY ?? import.meta.env?.PUBLIC_SUPABASE_ANON_KEY;
export const hayBaseDeDatos = !!(url && clave);
