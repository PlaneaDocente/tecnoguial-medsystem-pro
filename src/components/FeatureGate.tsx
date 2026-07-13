"use client";

import { useSubscription } from "@/hooks/useSubscription";
import { Lock, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function FeatureGate({ feature, children }: { feature: string; children: React.ReactNode }) {
  const { canUseFeature, plan, loading } = useSubscription();

  if (loading) return <div className="p-8 text-center">Verificando plan...</div>;
  
  if (!canUseFeature(feature)) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <Lock className="w-12 h-12 text-slate-300" />
        <h3 className="text-lg font-semibold">Función no disponible</h3>
        <p className="text-sm text-slate-500">
          Tu plan actual es <strong className="capitalize">{plan}</strong>. Actualiza para acceder.
        </p>
        <Link href="/billing" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg">
          Actualizar plan <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}