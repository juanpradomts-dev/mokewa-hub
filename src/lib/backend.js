// ¿Hay base de datos conectada? En producción la inscripción en línea y el panel dependen de ella
// (Supabase: supabase/migrations/). Se activa definiendo PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY
// al construir. Sin ella, la web oficial funciona igual y deriva las inscripciones al contacto del club.
// La clave «anon» es pública por diseño: lo privado lo protege Row Level Security en la base de datos.
export const urlBaseDeDatos = globalThis.process?.env?.PUBLIC_SUPABASE_URL ?? import.meta.env?.PUBLIC_SUPABASE_URL ?? "";
export const clavePublica = globalThis.process?.env?.PUBLIC_SUPABASE_ANON_KEY ?? import.meta.env?.PUBLIC_SUPABASE_ANON_KEY ?? "";
export const hayBaseDeDatos = !!(urlBaseDeDatos && clavePublica);
