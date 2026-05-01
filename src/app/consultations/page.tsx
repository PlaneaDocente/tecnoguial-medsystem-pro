'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ClipboardList,
  Plus,
  Search,
  Calendar,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import type { Consultation, Patient } from '@/lib/types';

export default function ConsultationsPage() {
  const { user } = useAuth();
  const [consultations, setConsultations] = useState<(Consultation & { patient?: Patient })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    if (user) fetchConsultations();
  }, [user, typeFilter, currentPage]);

  const fetchConsultations = async () => {
    if (!user) return;
    setLoading(true);

    try {
      let query = supabase
        .from('consultations')
        .select('*, patient:patients(id, first_name, last_name)')
        .eq('user_id', user.id)
        .order('consultation_date', { ascending: false });

      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter);
      }

      const from = (currentPage - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, error } = await query;
      if (error) throw error;
      setConsultations(data || []);
    } catch (error) {
      console.error('Error fetching consultations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      general: 'Consulta General',
      seguimiento: 'Seguimiento',
      urgencia: 'Urgencia',
      psicologica: 'Psicológica'
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      general: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      seguimiento: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      urgencia: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      psicologica: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
    };
    return colors[type] || colors.general;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Consultas</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Historial de consultas médicas
          </p>
        </div>
        <Link href="/consultations/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          Nueva Consulta
        </Link>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar por paciente o diagnóstico..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">Todos los tipos</option>
            <option value="general">Consulta General</option>
            <option value="seguimiento">Seguimiento</option>
            <option value="urgencia">Urgencia</option>
            <option value="psicologica">Psicológica</option>
          </select>
        </div>
      </Card>

      {consultations.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardList className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            No hay consultas registradas
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Comienza registrando tu primera consulta
          </p>
          <Link href="/consultations/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            Nueva Consulta
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {consultations.map((consultation) => (
            <Link key={consultation.id} href={`/consultations/${consultation.id}`}>
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {consultation.patient?.first_name?.charAt(0)}{consultation.patient?.last_name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {consultation.patient?.first_name} {consultation.patient?.last_name}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(consultation.consultation_date).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                        <span>·</span>
                        <Clock className="w-3 h-3" />
                        {new Date(consultation.consultation_date).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={getTypeColor(consultation.type)}>
                      {getTypeLabel(consultation.type)}
                    </Badge>
                    <Badge variant={consultation.status === 'completed' ? 'default' : 'secondary'}>
                      {consultation.status === 'completed' ? 'Completada' : 'Borrador'}
                    </Badge>
                  </div>
                </div>
                {consultation.chief_complaint && (
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                    <span className="font-medium">Motivo:</span> {consultation.chief_complaint}
                  </p>
                )}
                {consultation.diagnosis_names && consultation.diagnosis_names.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {consultation.diagnosis_names.slice(0, 3).map((name, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {name}
                      </Badge>
                    ))}
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
