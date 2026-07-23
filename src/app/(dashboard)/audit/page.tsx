'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  Search,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
  Lock
} from 'lucide-react';

type AuditEntry = {
  id: number;
  occurred_at: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  patient_id: string | null;
  old_data: any;
  new_data: any;
  ip_address: string | null;
  user_agent: string | null;
  integrity_hash: string | null;
};

const actionLabels: Record<string, string> = {
  INSERT: 'Creacion',
  UPDATE: 'Modificacion',
  DELETE: 'Eliminacion',
};

const actionColors: Record<string, string> = {
  INSERT: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const tableLabels: Record<string, string> = {
  patients: 'Pacientes',
  consultations: 'Consultas',
  prescriptions: 'Recetas',
  prescription_items: 'Medicamentos de receta',
  patient_files: 'Archivos',
  appointments: 'Citas',
  patient_allergies: 'Alergias',
  patient_antecedents: 'Antecedentes',
  patient_chronic_diseases: 'Enfermedades cronicas',
};

export default function AuditPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [tableFilter, setTableFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const pageSize = 25;

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      let query = supabase
        .from('audit_log')
        .select('*', { count: 'exact' })
        .order('occurred_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (actionFilter !== 'all') query = query.eq('action', actionFilter);
      if (tableFilter !== 'all') query = query.eq('table_name', tableFilter);
      if (search.trim()) query = query.ilike('actor_email', `%${search.trim()}%`);

      const { data, error: qErr, count } = await query;
      if (qErr) {
        if (qErr.code === '42P01') {
          throw new Error('La bitacora aun no existe. Aplica la migracion SQL en Supabase.');
        }
        throw qErr;
      }
      setEntries(data || []);
      setTotal(count || 0);
    } catch (err: any) {
      console.error('Error cargando bitacora:', err);
      setError(err?.message || 'Error al cargar la bitacora');
    } finally {
      setLoading(false);
    }
  }, [user, page, actionFilter, tableFilter, search]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  // Campos que cambiaron entre old_data y new_data
  const getChangedFields = (entry: AuditEntry): string[] => {
    if (entry.action !== 'UPDATE' || !entry.old_data || !entry.new_data) return [];
    const changed: string[] = [];
    Object.keys(entry.new_data).forEach((k) => {
      if (JSON.stringify(entry.old_data[k]) !== JSON.stringify(entry.new_data[k])) {
        changed.push(k);
      }
    });
    return changed;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
            Bitacora de Auditoria
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Registro inmutable de accesos y cambios en datos clinicos
          </p>
        </div>
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-3">
        <Lock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900 dark:text-blue-200">
          <p className="font-medium">Este registro no puede modificarse ni eliminarse</p>
          <p className="mt-1 text-blue-700 dark:text-blue-300">
            Conforme a NOM-024-SSA3-2012. Cada entrada incluye un hash de integridad que permite
            verificar que no fue alterada.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">{error}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={fetchEntries}>
              Reintentar
            </Button>
          </div>
        </div>
      )}

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar por usuario..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10"
            />
          </div>
          <select
            className="h-10 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          >
            <option value="all">Todas las acciones</option>
            <option value="INSERT">Creaciones</option>
            <option value="UPDATE">Modificaciones</option>
            <option value="DELETE">Eliminaciones</option>
          </select>
          <select
            className="h-10 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
            value={tableFilter}
            onChange={(e) => { setTableFilter(e.target.value); setPage(1); }}
          >
            <option value="all">Todos los modulos</option>
            {Object.entries(tableLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : entries.length === 0 ? (
        <Card className="p-12 text-center">
          <ShieldCheck className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            Sin registros
          </h3>
          <p className="text-slate-500 dark:text-slate-400">
            Aun no hay actividad registrada, o los filtros no arrojan resultados.
          </p>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700">
                  <tr>
                    <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-300">Fecha y hora</th>
                    <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-300">Usuario</th>
                    <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-300">Accion</th>
                    <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-300">Modulo</th>
                    <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-300">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                      onClick={() => setSelected(e)}
                    >
                      <td className="p-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {formatDateTime(e.occurred_at)}
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300">
                        {e.actor_email || 'Sistema'}
                      </td>
                      <td className="p-3">
                        <Badge className={actionColors[e.action] || ''}>
                          {actionLabels[e.action] || e.action}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300">
                        {tableLabels[e.table_name] || e.table_name}
                      </td>
                      <td className="p-3 text-slate-500 text-xs">
                        {e.action === 'UPDATE'
                          ? `${getChangedFields(e).length} campo(s) modificado(s)`
                          : 'Ver detalle'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Mostrando {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} de {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="flex items-center px-3 text-sm text-slate-500">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline" size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Detalle de la entrada */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-xl max-w-3xl w-full my-8"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
              <h3 className="font-semibold">Detalle del registro #{selected.id}</h3>
              <button
                onClick={() => setSelected(null)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Fecha y hora</p>
                  <p className="font-medium">{formatDateTime(selected.occurred_at)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Usuario</p>
                  <p className="font-medium">{selected.actor_email || 'Sistema'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Rol</p>
                  <p className="font-medium">{selected.actor_role || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Accion</p>
                  <Badge className={actionColors[selected.action] || ''}>
                    {actionLabels[selected.action] || selected.action}
                  </Badge>
                </div>
                <div>
                  <p className="text-slate-500">Modulo</p>
                  <p className="font-medium">{tableLabels[selected.table_name] || selected.table_name}</p>
                </div>
                <div>
                  <p className="text-slate-500">Registro</p>
                  <p className="font-mono text-xs break-all">{selected.record_id || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Direccion IP</p>
                  <p className="font-medium">{selected.ip_address || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Dispositivo</p>
                  <p className="text-xs break-words">{selected.user_agent || '—'}</p>
                </div>
              </div>

              {selected.action === 'UPDATE' && getChangedFields(selected).length > 0 && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Campos modificados</p>
                  <div className="space-y-2">
                    {getChangedFields(selected).map((field) => (
                      <div key={field} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm">
                        <p className="font-medium mb-1">{field}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-red-600">Antes: </span>
                            <span className="break-all">
                              {JSON.stringify(selected.old_data?.[field]) ?? '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-green-600">Despues: </span>
                            <span className="break-all">
                              {JSON.stringify(selected.new_data?.[field]) ?? '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.action === 'DELETE' && selected.old_data && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Datos eliminados</p>
                  <pre className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selected.old_data, null, 2)}
                  </pre>
                </div>
              )}

              {selected.action === 'INSERT' && selected.new_data && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Datos creados</p>
                  <pre className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selected.new_data, null, 2)}
                  </pre>
                </div>
              )}

              <div className="pt-3 border-t dark:border-slate-700">
                <p className="text-xs text-slate-500 mb-1">Hash de integridad (SHA-256)</p>
                <p className="font-mono text-xs break-all text-slate-600 dark:text-slate-400">
                  {selected.integrity_hash || '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
