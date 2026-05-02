'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function NewAppointmentPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [patientId, setPatientId] = useState('');
  const [type, setType] = useState('general');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const { error } = await (supabase as any).from('appointments').insert({
        user_id: user.id,
        patient_id: patientId || null,
        date,
        start_time: startTime,
        type,
        notes,
        status: 'pending'
      });

      if (error) throw error;
      toast.success('Cita agendada correctamente');
      router.push('/appointments');
    } catch (err: any) {
      toast.error(err?.message || 'Error al agendar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/appointments" className="p-2 hover:bg-slate-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">Nueva Cita</h1>
      </div>

      <Card className="p-6 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Fecha</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Hora</label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-slate-800">
              <option value="general">General</option>
              <option value="seguimiento">Seguimiento</option>
              <option value="urgencia">Urgencia</option>
              <option value="psicologica">Psicológica</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ID Paciente (opcional)</label>
            <Input value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="UUID del paciente" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notas</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionales" />
          </div>
          <Button type="submit" disabled={loading || !date || !startTime} className="w-full">
            {loading ? 'Guardando...' : 'Agendar Cita'}
          </Button>
        </form>
      </Card>
    </div>
  );
}