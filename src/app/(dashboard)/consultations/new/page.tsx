'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function NewConsultationPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPatientId = searchParams.get('patientId') || '';
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [patientId, setPatientId] = useState(preselectedPatientId);
  const [type, setType] = useState('general');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!user) {
      setError('Debes iniciar sesión');
      toast.error('Debes iniciar sesión');
      return;
    }

    setLoading(true);

    try {
      const { data, error: insertError } = await supabase
        .from('consultations')
        .insert({
          user_id: user.id,
          patient_id: patientId.trim() || null,
          type,
          chief_complaint: chiefComplaint.trim() || null,
          notes: notes.trim() || null,
          status: 'completed',
          consultation_date: new Date().toISOString()
        })
        .select()
        .maybeSingle();

      if (insertError) {
        throw new Error(insertError.message || insertError.details || 'Error al guardar la consulta');
      }

      toast.success('Consulta registrada correctamente');
      router.push('/consultations');
    } catch (err: any) {
      console.error('Error creating consultation:', err);
      const msg = err?.message || 'Error al guardar';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/consultations" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">Nueva Consulta</h1>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">ID Paciente (opcional)</label>
            <Input value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="UUID del paciente" />
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
            <label className="block text-sm font-medium mb-1">Motivo de consulta</label>
            <Input value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} placeholder="Ej: Dolor de cabeza" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notas médicas</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones" />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Guardando...' : 'Guardar Consulta'}
          </Button>
        </form>
      </Card>
    </div>
  );
}