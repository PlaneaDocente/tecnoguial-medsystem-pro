'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Plus,
  Search,
  MoreVertical,
  Phone,
  Mail,
  AlertTriangle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import type { Patient } from '@/lib/types';

// Extiende el tipo con el campo que agregamos manualmente
interface PatientWithAllergies extends Patient {
  allergiesCount: number;
}

export default function PatientsPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<PatientWithAllergies[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce: input inmediato vs query aplicada a Supabase
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  // Efecto de debounce: solo actualiza searchQuery después de 300ms sin escribir
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1); // reset a página 1 al cambiar búsqueda
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchPatients = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('patients')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (searchQuery) {
        query = query.or(
          `first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`
        );
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error: patientsError } = await query;

      if (patientsError) throw patientsError;

      const total = count || 0;
      setTotalPages(Math.max(1, Math.ceil(total / pageSize)));

      if (!data || data.length === 0) {
        setPatients([]);
        return;
      }

      // Batch: una sola query para contar alergias de todos los pacientes visibles
      const patientIds = data.map((p) => p.id);
      const { data: allergiesData, error: allergiesError } = await supabase
        .from('patient_allergies')
        .select('patient_id')
        .in('patient_id', patientIds);

      if (allergiesError) throw allergiesError;

      // Mapeo de conteos
      const counts = new Map<string, number>();
      allergiesData?.forEach((a) => {
        counts.set(a.patient_id, (counts.get(a.patient_id) || 0) + 1);
      });

      const merged: PatientWithAllergies[] = data.map((p) => ({
        ...p,
        allergiesCount: counts.get(p.id) || 0,
      }));

      setPatients(merged);
    } catch (err: any) {
      console.error('Error fetching patients:', err);
      setError(err?.message || 'Error al cargar los pacientes');
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, [user, searchQuery, statusFilter, currentPage]);

  // Fetch principal con protección contra memory leak
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await fetchPatients();
      if (cancelled) return;
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [fetchPatients]);

  const getAge = (birthDate: string | null) => {
    if (!birthDate) return 'N/A';
    try {
      const today = new Date();
      const birth = new Date(birthDate);
      if (isNaN(birth.getTime())) return 'N/A';
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return `${age} años`;
    } catch {
      return 'N/A';
    }
  };

  const getGenderLabel = (gender: string | null) => {
    const labels: Record<string, string> = {
      male: 'Masculino',
      female: 'Femenino',
      other: 'Otro',
    };
    return labels[gender || ''] || 'N/A';
  };

  if (loading && patients.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <AlertTriangle className="w-12 h-12 text-red-500" />
        <p className="text-red-600 font-medium">{error}</p>
        <Button onClick={() => fetchPatients()} variant="outline">
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pacientes</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Gestiona tu directorio de pacientes
          </p>
        </div>
        <Link
          href="/patients/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Paciente
        </Link>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar por nombre, CURP, email o teléfono..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'all' | 'active' | 'inactive');
                setCurrentPage(1);
              }}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Patients List */}
      {patients.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            No hay pacientes registrados
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            {searchQuery || statusFilter !== 'all'
              ? 'Intenta con otros filtros de búsqueda'
              : 'Comienza agregando tu primer paciente'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <Link
              href="/patients/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agregar Paciente
            </Link>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Paciente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Contacto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Datos
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Alergias
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {patients.map((patient) => (
                  <tr
                    key={patient.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <Link
                        href={`/patients/${patient.id}`}
                        className="flex items-center gap-3"
                      >
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                          {patient.first_name?.charAt(0) || '?'}
                          {patient.last_name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white hover:text-blue-600">
                            {patient.first_name} {patient.last_name}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {getAge(patient.birth_date)}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <p className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
                          <Phone className="w-3 h-3" />
                          {patient.phone || 'N/A'}
                        </p>
                        {patient.email && (
                          <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <Mail className="w-3 h-3" />
                            {patient.email}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {getGenderLabel(patient.gender)}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {patient.blood_type || 'N/A'}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      {patient.allergiesCount > 0 ? (
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                          <AlertTriangle className="w-3 h-3" />
                          {patient.allergiesCount}
                        </Badge>
                      ) : (
                        <span className="text-sm text-slate-400">Sin alergias</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <Badge
                        variant={patient.status === 'active' ? 'default' : 'secondary'}
                        className={
                          patient.status === 'active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : ''
                        }
                      >
                        {patient.status === 'active' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/patients/${patient.id}`}>Ver expediente</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/consultations/new?patientId=${patient.id}`}>
                              Nueva consulta
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/appointments/new?patientId=${patient.id}`}>
                              Agendar cita
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Página {currentPage} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}