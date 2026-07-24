'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Archive, Clock, AlertTriangle, Search, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

type RetentionRow = {
  patient_id: string;
  first_name: string | null;
  last_name: string | null;
  archived_at: string | null;
  last_activity: string | null;
  retention_until: string | null;
  retention_expired: boolean;
  days_remaining: number;
};

export default function RetentionPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<RetentionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchRetention = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('v_patient_retention')
        .select('*')
        .eq('user_id', user.id)
        .order('retention_until', { ascending: true });

      if (error) throw error;
      setRows(data || []);
    } catch (err: any) {
      console.error('Error loading retention:', err);
      toast.error(err?.message || 'Error al cargar la conservación');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRetention();
  }, [fetchRetention]);

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const statusBadge = (r: RetentionRow) => {
    if (r.retention_expired) {
      return (
        <Badge className="bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 gap-1">
          <Archive className="w-3 h-3" /> Plazo cumplido
        </Badge>
      );
    }
    if (r.days_remaining < 365) {
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 gap-1">
          <Clock className="w-3 h-3" /> Último año
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 gap-1">
        <ShieldCheck className="w-3 h-3" /> En conservación
      </Badge>
    );
  };

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase().includes(q);
  });

  const expired = rows.filter((r) => r.retention_expired).length;
  const lastYear = rows.filter((r) => !r.retention_expired && r.days_remaining < 365).length;
  const active = rows.length - expired - lastYear;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Conservación de expedientes</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Plazo mínimo de 5 años desde el último acto médico (NOM-004-SSA3-2012)
        </p>
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <p className="font-medium">Ningún expediente se elimina automáticamente</p>
          <p>
            Cumplir el plazo no obliga a destruir: habilita a hacerlo. La decisión de depurar un
            expediente debe tomarse caso por caso y conviene consultarla con tu abogado, ya que
            un litigio abierto, una obligación fiscal o un requerimiento de autoridad pueden
            exigir conservarlo más tiempo.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-2xl font-bold text-green-600">{active}</p>
          <p className="text-sm text-slate-500">En conservación obligatoria</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-bold text-amber-600">{lastYear}</p>
          <p className="text-sm text-slate-500">En su último año</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-bold text-slate-600 dark:text-slate-300">{expired}</p>
          <p className="text-sm text-slate-500">Plazo cumplido</p>
        </Card>
      </div>

      <Card className="p-6">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar paciente..."
            className="pl-10"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-slate-500 py-8">No hay pacientes que mostrar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 pr-4 font-medium">Paciente</th>
                  <th className="py-2 pr-4 font-medium">Último acto médico</th>
                  <th className="py-2 pr-4 font-medium">Conservar hasta</th>
                  <th className="py-2 pr-4 font-medium">Restante</th>
                  <th className="py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.patient_id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-3 pr-4">
                      <Link href={`/patients/${r.patient_id}`} className="font-medium text-blue-600 hover:underline">
                        {r.last_name}, {r.first_name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{fmt(r.last_activity)}</td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{fmt(r.retention_until)}</td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">
                      {r.retention_expired ? '—' : `${Math.floor(r.days_remaining / 365)} a ${r.days_remaining % 365} d`}
                    </td>
                    <td className="py-3">{statusBadge(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-slate-500">
        El plazo se recalcula solo: cada nueva consulta, receta o archivo del paciente reinicia los 5 años
        desde esa fecha.
      </p>
    </div>
  );
}
