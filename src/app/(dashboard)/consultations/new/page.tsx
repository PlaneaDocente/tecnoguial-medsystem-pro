'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, FilePlus2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function NewConsultationPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPatientId = searchParams.get('patientId') || '';
  const parentId = searchParams.get('parentId') || '';
  const isAdenda = !!parentId;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [patientId, setPatientId] = useState(preselectedPatientId);
  const [type, setType] = useState(isAdenda ? 'seguimiento' : 'general');
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

    if (isAdenda && !notes.trim()) {
      setError('La adenda debe incluir la nota de corrección o aclaración');
      toast.error('La adenda debe incluir la nota de corrección o aclaración');
      return;
    }

    setLoading(true);

    try {
      const { data, error: insertError } = await supabase
        .from('consultations')
        .insert({
          user_id: user.id,
          patient_id: patientId.trim() || null,
          parent_consultation_id: parentId || null,
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

      toast.success(isAdenda ? 'Adenda registrada correctamente' : 'Consulta registrada correctamente');
      router.push(isAdenda ? `/consultations/${parentId}` : '/consultations');
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
        <Link href={isAdenda ? `/consultations/${parentId}` : '/consultations'} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">{isAdenda ? 'Nueva Adenda' : 'Nueva Consulta'}</h1>
      </div>

      {isAdenda && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-3">
          <FilePlus2 className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700 dark:text-blue-400">
            Esta nota quedará ligada a la consulta original como adenda (NOM-004-SSA3-2012).
            La consulta original no se modifica: la adenda registra la corrección, aclaración o evolución con su propia fecha y firma.
          </p>
        </div>
      )}

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
            <label className="block text-sm font-medium mb-1">{isAdenda ? 'Motivo de la adenda' : 'Motivo de consulta'}</label>
            <Input value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} placeholder={isAdenda ? 'Ej: Corrección de dosis indicada' : 'Ej: Dolor de cabeza'} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{isAdenda ? 'Nota de adenda *' : 'Notas médicas'}</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={isAdenda ? 'Corrección, aclaración o evolución' : 'Observaciones'} />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Guardando...' : (isAdenda ? 'Guardar Adenda' : 'Guardar Consulta')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
