import { createClient, SupabaseClient } from "@supabase/supabase-js";

type TypedSupabaseClient = SupabaseClient<any, "public", any>;

declare global {
  var __supabaseClient: TypedSupabaseClient | undefined;
}

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (supabaseUrl) {
  const original = supabaseUrl;
  supabaseUrl = supabaseUrl.replace(/\/(rest|auth)\/v1\/?$/i, "");
  supabaseUrl = supabaseUrl.replace(/\/$/, "");
  if (original !== supabaseUrl) {
    console.warn("[Supabase] URL corregida automaticamente:");
    console.warn("  Original:", original);
    console.warn("  Corregida:", supabaseUrl);
  }
}

function isValidConfig(): boolean {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  if (!supabaseUrl.startsWith("http")) return false;
  if (
    supabaseUrl.includes("TU_URL") ||
    supabaseUrl.includes("YOUR_URL") ||
    supabaseUrl.includes("example") ||
    supabaseUrl.includes("placeholder")
  )
    return false;
  if (
    supabaseAnonKey.includes("YOUR_KEY") ||
    supabaseAnonKey.includes("placeholder")
  )
    return false;
  if (supabaseAnonKey.length < 20) return false;
  return true;
}

// LIMPIEZA DEFENSIVA DE LOCALSTORAGE
// Borra tokens corruptos ANTES de que Supabase los lea
function cleanCorruptAuthTokens() {
  if (typeof window === "undefined") return;
  try {
    const allKeys = Object.keys(localStorage);
    const authKeys = allKeys.filter(
      (k) => k.startsWith("sb-") && k.includes("auth-token")
    );

    for (const key of authKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        const hasRefresh = !!parsed?.refresh_token;
        const expiresAt = parsed?.expires_at ? parsed.expires_at * 1000 : 0;
        const isExpired = expiresAt > 0 && expiresAt < Date.now();

        if (!hasRefresh || isExpired) {
          console.warn("[Supabase] Limpiando token corrupto/expirado:", key);
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // noop
  }
}

function createDummyClient(): TypedSupabaseClient {
  const offlineError = (method: string) => ({
    data: { session: null, user: null, identities: [] },
    error: {
      message: `Supabase offline — ${method}. Revisa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY`,
      status: 400,
      name: "AuthApiError",
    } as any,
  });

  const dummySub = { subscription: { unsubscribe: () => {} } };

  const createQueryBuilder = () => {
    const builder: any = {
      select: (_columns?: string) => builder,
      insert: (_values: any, _options?: any) => ({
        select: () => builder,
        single: () => Promise.resolve({ data: null, error: null }),
      }),
      update: (_values: any) => ({
        eq: () => builder,
        match: () => builder,
      }),
      delete: () => ({
        eq: () => builder,
        match: () => builder,
      }),
      upsert: (_values: any) => builder,
      eq: (_column: string, _value: any) => builder,
      neq: (_column: string, _value: any) => builder,
      gt: (_column: string, _value: any) => builder,
      lt: (_column: string, _value: any) => builder,
      gte: (_column: string, _value: any) => builder,
      lte: (_column: string, _value: any) => builder,
      like: (_column: string, _pattern: string) => builder,
      ilike: (_column: string, _pattern: string) => builder,
      is: (_column: string, _value: any) => builder,
      in: (_column: string, _values: any[]) => builder,
      contains: (_column: string, _value: any) => builder,
      containedBy: (_column: string, _value: any) => builder,
      rangeGte: (_column: string, _from: any, _to: any) => builder,
      rangeGt: (_column: string, _from: any, _to: any) => builder,
      rangeLte: (_column: string, _from: any, _to: any) => builder,
      rangeLt: (_column: string, _from: any, _to: any) => builder,
      overlaps: (_column: string, _value: any) => builder,
      textSearch: (_column: string, _query: string) => builder,
      match: (_query: Record<string, any>) => builder,
      not: (_column: string, _operator: string, _value: any) => builder,
      or: (_filters: string) => builder,
      and: (_filters: string) => builder,
      filter: (_column: string, _operator: string, _value: any) => builder,
      order: (_column: string, _options?: any) => builder,
      limit: (_count: number) => builder,
      range: (_from: number, _to: number) => builder,
      single: () => Promise.resolve({ data: null, error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      csv: () => Promise.resolve({ data: "", error: null }),
      then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
    };
    return builder;
  };

  const dummy = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      onAuthStateChange: () => dummySub,
      signInWithPassword: () => Promise.resolve(offlineError("signInWithPassword")),
      signInWithOtp: () => Promise.resolve(offlineError("signInWithOtp")),
      signInWithOAuth: () => Promise.resolve(offlineError("signInWithOAuth")),
      signUp: () => Promise.resolve(offlineError("signUp")),
      signOut: () => Promise.resolve({ error: null }),
      resetPasswordForEmail: () => Promise.resolve(offlineError("resetPassword")),
      updateUser: () => Promise.resolve(offlineError("updateUser")),
      refreshSession: () => Promise.resolve(offlineError("refreshSession")),
      resend: () => Promise.resolve(offlineError("resend")),
      exchangeCodeForSession: () => Promise.resolve(offlineError("exchangeCodeForSession")),
    },
    from: (_table: string) => createQueryBuilder(),
    storage: {
      from: (_bucket: string) => ({
        upload: () => Promise.resolve({ data: null, error: { message: "offline" } }),
        download: () => Promise.resolve({ data: null, error: { message: "offline" } }),
        getPublicUrl: (_path: string) => ({ data: { publicUrl: "" } }),
        createSignedUrl: () => Promise.resolve({ data: null, error: { message: "offline" } }),
        remove: () => Promise.resolve({ data: null, error: null }),
        list: () => Promise.resolve({ data: [], error: null }),
      }),
    },
    channel: (_name: string) => ({
      on: () => dummy.channel(""),
      subscribe: () => dummySub,
    }),
    removeChannel: () => {},
    removeAllChannels: () => {},
    rpc: () => Promise.resolve({ data: null, error: { message: "offline" } }),
  };

  return dummy as unknown as TypedSupabaseClient;
}

function createSupabaseClient(): TypedSupabaseClient {
  if (!isValidConfig()) {
    console.error("[Supabase] Variables de entorno invalidas. Cliente en modo offline.");
    console.error("  URL recibida:", supabaseUrl || "undefined");
    console.error("  Key recibida:", supabaseAnonKey ? "****" + supabaseAnonKey.slice(-4) : "undefined");
    return createDummyClient();
  }

  cleanCorruptAuthTokens();

  const client = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // CAMBIO: era `false`. Debe estar en `true` para que el flujo OAuth
      // (Google Sign-In) procese los tokens que Supabase envia en el URL
      // al redirigir a /auth/callback.
      detectSessionInUrl: true,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
    db: { schema: "public" },
  });

  console.log("[Supabase] Cliente inicializado correctamente:", supabaseUrl);
  return client;
}

const supabase = globalThis.__supabaseClient ?? createSupabaseClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__supabaseClient = supabase;
}

export { supabase };
