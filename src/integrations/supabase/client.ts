import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Cliente real o dummy: nunca lanza errores síncronos que rompan React SSR
let supabase: ReturnType<typeof createClient>;

const isValidUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  if (url.includes("TU_URL") || url.includes("YOUR_URL") || url.includes("example")) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

if (!isValidUrl(supabaseUrl) || !supabaseAnonKey || supabaseAnonKey.length < 20) {
  console.warn("⚠️ [Supabase] NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY no configuradas. Cliente en modo offline.");

  // Dummy que imita la API exacta que usamos en useAuth y en el dashboard
  const dummySubscription = {
    subscription: {
      unsubscribe: () => {},
    },
  };

  const dummyAuth = {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: () => dummySubscription,
    signOut: () => Promise.resolve({ error: null }),
  };

  const dummyFrom = () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        order: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
      order: () => Promise.resolve({ data: [], error: null }),
    }),
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => Promise.resolve({ data: null, error: null }),
    delete: () => Promise.resolve({ data: null, error: null }),
  });

  supabase = {
    auth: dummyAuth,
    from: dummyFrom,
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
        remove: () => Promise.resolve({ data: null, error: null }),
      }),
    },
  } as any;
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export { supabase };