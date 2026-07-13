'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, AlertCircle, CalendarDays, Clock } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

type PatientOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};

export default function NewAppointmentPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPatientId = searchParams.get('patientId') || '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);

  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [patientId, setPatientId] = useState(preselectedPatientId);
  const [type, setType] = useState('general');
  const [notes, setNotes] = useState('');

  // Cargar pacientes del doctor para el select
  useEffect(() => {
    if (!user) return;
    const fetchPatients = async () => {
      setLoadingPatients(true);
      try {
        const { data, error: qError } = await supabase
          .from('patients')
          .select('id, first_name, last_name, phone')
          .eq('user_id', user.id)
          .order('last_name', { ascending: true });

        if (qError) throw qError;
        setPatients(data || []);
      } catch (err: any) {
        console.warn('Error cargando pacientes:', err);
      } finally {
        setLoadingPatients(false);
      }
    };
    fetchPatients();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user) {
      toast.error('Debes iniciar sesión');
      return;
    }

    if (!date || !startTime) {
      setError('La fecha y hora son obligatorias');
      toast.error('La fecha y hora son obligatorias');
      return;
    }

    const selectedDate = new Date(date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      setError('No puedes agendar citas en fechas pasadas');
      toast.error('No puedes agendar citas en fechas pasadas');
      return;
    }

    setLoading(true);

    try {
      const payload: Record<string, any> = {
        user_id: user.id,
        date,
        start_time: startTime,
        type,
        status: 'pending'
      };

      // Solo agregar patient_id si es un UUID válido (36 chars con guiones)
      if (patientId && patientId.trim().length === 36) {
        payload.patient_id = patientId.trim();
      }

      if (notes.trim()) payload.notes = notes.trim();

      const { data, error: insertError } = await supabase
        .from('appointments')
        .insert(payload)
        .select()
        .maybeSingle();

      if (insertError) {
        throw new Error(insertError.message || 'Error al guardar la cita');
      }

      toast.success('Cita agendada correctamente');
      router.push('/appointments');
    } catch (err: any) {
      console.error('Error creating appointment:', err);
      const msg = err?.message || 'Error al agendar';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/appointments" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nueva Cita</h1>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-500" />
              Fecha *
            </label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              Hora *
            </label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tipo de cita</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="general">Consulta General</option>
              <option value="seguimiento">Seguimiento</option>
              <option value="urgencia">Urgencia</option>
              <option value="psicologica">Psicológica</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Paciente</label>
            {loadingPatients ? (
              <div className="h-10 flex items-center text-sm text-slate-500">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent mr-2" />
                Cargando pacientes...
              </div>
            ) : patients.length === 0 ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700">
                No tienes pacientes registrados. <Link href="/patients/new" className="underline font-medium">Registra uno primero</Link>.
              </div>
            ) : (
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">-- Seleccionar paciente (opcional) --</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.last_name || ''} {p.first_name || ''} {p.phone ? `(${p.phone})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Notas</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones adicionales..." />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Guardando...' : 'Agendar Cita'}
          </Button>
        </form>
      </Card>
    </div>
  );
}