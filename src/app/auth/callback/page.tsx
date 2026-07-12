"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function completeSignIn() {
      try {
        // Con detectSessionInUrl: true, supabase-js ya procesó los tokens
        // del URL hash automáticamente. Solo verificamos que la sesión existe.
        // Retry corto (hasta 2 segundos) por si supabase-js tarda un tick.
        for (let i = 0; i < 20; i++) {
          if (cancelled) return;
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            router.replace("/dashboard");
            return;
          }
          await new Promise((r) => setTimeout(r, 100));
        }
        if (!cancelled) {
          setError("No se pudo completar el inicio de sesión. Intenta de nuevo.");
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Error desconocido";
          setError(msg);
        }
      }
    }

    completeSignIn();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 px-4">
      {error ? (
        <div className="flex flex-col items-center text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            No pudimos completar el inicio de sesión
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mb-6">{error}</p>
          <button
            onClick={() => router.replace("/login")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Volver al inicio de sesión
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
          <p className="text-slate-500 dark:text-slate-400">Completando inicio de sesión...</p>
        </div>
      )}
    </div>
  );
}
