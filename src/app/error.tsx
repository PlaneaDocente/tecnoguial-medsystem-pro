"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ErrorPage] Error capturado en boundary:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-800 p-6 shadow-lg">
        <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
          Error en MedSystem Pro
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
          La aplicacion encontro un error critico y no puede continuar.
        </p>
        <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-3 mb-4 overflow-auto max-h-40">
          <code className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-all">
            {error?.message || "Error desconocido"}
          </code>
        </div>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Reintentar
          </button>
          <a
            href="/login"
            className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg transition-colors text-center"
          >
            Ir al Login
          </a>
        </div>
      </div>
    </div>
  );
}