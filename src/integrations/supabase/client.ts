import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validación profunda para evitar el spinner infinito
const isValidUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  if (url.includes("TU_URL") || url.includes("YOUR_URL")) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

let supabase: ReturnType<typeof createClient>;

if (!isValidUrl(supabaseUrl) || !supabaseAnonKey) {
  console.error("❌ [Supabase] NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY no están configuradas correctamente.");
  console.error("   URL recibida:", supabaseUrl);
  
  // Creamos un cliente dummy para que la app no explote en imports,
  // pero que avise si intentan usarlo.
  const dummyClient = new Proxy({} as any, {
    get: (_target, prop) => {
      return () => {
        throw new Error(`Supabase no está configurado. Revisa las variables de entorno en Vercel. Método llamado: ${String(prop)}`);
      };
    },
  });
  supabase = dummyClient;
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export { supabase };