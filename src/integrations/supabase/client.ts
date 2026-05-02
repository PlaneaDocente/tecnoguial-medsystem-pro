import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const isValidUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  if (url.includes("TU_URL") || url.includes("YOUR_URL") || url.includes("example") || url.includes("placeholder")) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Tipo flexible que acepta tanto el cliente real como el dummy
let supabase: any;

if (!isValidUrl(supabaseUrl) || !supabaseAnonKey || supabaseAnonKey.length < 20) {
  console.warn("⚠️ [Supabase] NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY no están configuradas correctamente.");
  console.warn("   → Cliente funcionando en MODO OFFLINE (solo lectura local, sin persistencia).");
  console.warn("   → Para habilitar Supabase real, configura las variables en Vercel.");

  // Dummy subscription para onAuthStateChange
  const dummySubscription = {
    subscription: { unsubscribe: () => {} },
  };

  // Auth dummy completo con todos los métodos que usa una app típica
  const dummyAuth = {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    
    onAuthStateChange: () => dummySubscription,
    
    signInWithPassword: (credentials: any) => {
      console.error("❌ [Supabase Offline] signInWithPassword no disponible. Revisa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en Vercel.");
      return Promise.resolve({
        data: { session: null, user: null },
        error: {
          message: "Supabase no está configurado. Verifica las variables de entorno.",
          status: 400,
        },
      });
    },
    
    signUp: (credentials: any) => {
      console.error("❌ [Supabase Offline] signUp no disponible. Revisa las variables de entorno.");
      return Promise.resolve({
        data: { session: null, user: null },
        error: {
          message: "Supabase no está configurado. No se puede registrar.",
          status: 400,
        },
      });
    },
    
    signInWithOtp: (credentials: any) => {
      console.error("❌ [Supabase Offline] signInWithOtp no disponible.");
      return Promise.resolve({
        data: { session: null, user: null },
        error: { message: "Supabase offline.", status: 400 },
      });
    },
    
    signInWithOAuth: (credentials: any) => {
      console.error("❌ [Supabase Offline] OAuth no disponible.");
      return Promise.resolve({
        data: { url: null, provider: credentials?.provider, session: null },
        error: { message: "Supabase offline.", status: 400 },
      });
    },
    
    signOut: () => Promise.resolve({ error: null }),
    
    resetPasswordForEmail: (email: string, options?: any) => {
      console.error("❌ [Supabase Offline] resetPassword no disponible.");
      return Promise.resolve({
        data: null,
        error: { message: "Supabase offline. No se puede enviar email.", status: 400 },
      });
    },
    
    updateUser: (attributes: any) => {
      console.error("❌ [Supabase Offline] updateUser no disponible.");
      return Promise.resolve({
        data: { user: null },
        error: { message: "Supabase offline.", status: 400 },
      });
    },
  };

  // Builder de queries dummy que encadena infinitamente y responde vacío
  const createDummyQueryBuilder = () => {
    const emptyResult = { data: null, error: null };
    const arrayResult = { data: [], error: null };
    
    const builder: any = {
      select: () => builder,
      insert: () => ({ ...builder, select: () => Promise.resolve(emptyResult) }),
      update: () => builder,
      delete: () => builder,
      upsert: () => builder,
      eq: () => builder,
      neq: () => builder,
      gt: () => builder,
      gte: () => builder,
      lt: () => builder,
      lte: () => builder,
      like: () => builder,
      ilike: () => builder,
      is: () => builder,
      in: () => builder,
      contains: () => builder,
      containedBy: () => builder,
      rangeLt: () => builder,
      rangeGt: () => builder,
      rangeGte: () => builder,
      rangeLte: () => builder,
      rangeAdjacent: () => builder,
      overlaps: () => builder,
      textSearch: () => builder,
      match: () => builder,
      not: () => builder,
      or: () => builder,
      and: () => builder,
      filter: () => builder,
      order: () => builder,
      limit: () => builder,
      single: () => Promise.resolve(emptyResult),
      maybeSingle: () => Promise.resolve(emptyResult),
      csv: () => Promise.resolve({ data: "", error: null }),
      then: (resolve: any) => Promise.resolve(arrayResult).then(resolve),
    };
    
    return builder;
  };

  const dummyFrom = (table: string) => createDummyQueryBuilder();

  supabase = {
    auth: dummyAuth,
    from: dummyFrom,
    rpc: (fn: string, params?: any) => {
      console.warn(`⚠️ [Supabase Offline] RPC ${fn} no ejecutado.`);
      return Promise.resolve({ data: null, error: null });
    },
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, file: any) => Promise.resolve({ data: null, error: { message: "Storage offline" } }),
        download: (path: string) => Promise.resolve({ data: null, error: { message: "Storage offline" } }),
        getPublicUrl: (path: string) => ({ data: { publicUrl: "" } }),
        remove: (paths: string[]) => Promise.resolve({ data: null, error: { message: "Storage offline" } }),
        list: (path?: string) => Promise.resolve({ data: [], error: null }),
      }),
    },
    channel: (name: string) => ({
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
      subscribe: () => ({ unsubscribe: () => {} }),
    }),
    removeChannel: () => Promise.resolve(),
    removeAllChannels: () => Promise.resolve(),
  };
} else {
  // Cliente Supabase REAL
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export { supabase };