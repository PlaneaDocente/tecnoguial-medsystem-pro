'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Clock, FileText, User, AlertCircle, Printer, Phone, Lock, FilePlus2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

type ConsultationWithPatient = {
  id: string;
  type: string;
  chief_complaint: string | null;
  notes: string | null;
  diagnosis_names: string[] | null;
  status: string;
  consultation_date: string;
  patient_id: string | null;
  parent_consultation_id: string | null;
  patient?: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    blood_type: string | null;
  } | null;
};

type Adenda = {
  id: string;
  type: string;
  chief_complaint: string | null;
  notes: string | null;
  consultation_date: string;
};

export default function ConsultationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const consultationId = params.id as string;

  const [consultation, setConsultation] = useState<ConsultationWithPatient | null>(null);
  const [adendas, setAdendas] = useState<Adenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (consultationId && user) {
      fetchConsultation();
    }
  }, [consultationId, user]);

  const fetchConsultation = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: queryError } = await supabase
        .from('consultations')
        .select('*, patient:patients(first_name, last_name, phone, blood_type)')
        .eq('id', consultationId)
        .eq('user_id', user?.id)
        .maybeSingle();

      if (queryError) throw queryError;

      if (!data) {
        setError('Consulta no encontrada');
      } else {
        setConsultation(data as ConsultationWithPatient);

        const { data: adendasData } = await supabase
          .from('consultations')
          .select('id, type, chief_complaint, notes, consultation_date')
          .eq('parent_consultation_id', consultationId)
          .order('consultation_date', { ascending: true });

        setAdendas(adendasData || []);
      }
    } catch (err: any) {
      console.error('Error fetching consultation:', err);
      setError(err?.message || 'Error al cargar la consulta');
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
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !consultation) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/consultations" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold">Error</h1>
        </div>
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
          <p className="text-red-600 font-medium">{error || 'Consulta no encontrada'}</p>
          <Link href="/consultations" className="mt-4 inline-block text-blue-600 hover:underline">
            Volver al listado
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/consultations" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {consultation.parent_consultation_id ? 'Detalle de Adenda' : 'Detalle de Consulta'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              {new Date(consultation.consultation_date).toLocaleDateString('es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {consultation.status === 'completed' && !consultation.parent_consultation_id && (
            <Link href={`/consultations/new?patientId=${consultation.patient_id || ''}&parentId=${consultation.id}`}>
              <Button variant="outline" className="gap-2">
                <FilePlus2 className="w-4 h-4" />
                Agregar Adenda
              </Button>
            </Link>
          )}
          <Button variant="outline" className="gap-2" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            Imprimir
          </Button>
        </div>
      </div>

      {consultation.parent_consultation_id && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-3">
          <FilePlus2 className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700 dark:text-blue-400">
            Esta nota es una adenda de otra consulta.{' '}
            <Link href={`/consultations/${consultation.parent_consultation_id}`} className="underline font-medium">
              Ver consulta original
            </Link>
          </p>
        </div>
      )}

      {consultation.status === 'completed' && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
          <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Registro clínico cerrado e inalterable (NOM-004-SSA3-2012). No puede editarse ni eliminarse;
            las correcciones o aclaraciones se registran mediante una adenda.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Badge className={getTypeColor(consultation.type)}>{getTypeLabel(consultation.type)}</Badge>
              <Badge variant={consultation.status === 'completed' ? 'default' : 'secondary'}>
                {consultation.status === 'completed' ? 'Completada' : 'Borrador'}
              </Badge>
            </div>

            {consultation.chief_complaint && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Motivo de Consulta
                </h3>
                <p className="text-slate-900 dark:text-white">{consultation.chief_complaint}</p>
              </div>
            )}

            {consultation.notes && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Notas Médicas</h3>
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{consultation.notes}</p>
                </div>
              </div>
            )}

            {consultation.diagnosis_names && consultation.diagnosis_names.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Diagnósticos</h3>
                <div className="flex flex-wrap gap-2">
                  {consultation.diagnosis_names.map((name, idx) => (
                    <Badge key={idx} variant="outline" className="text-sm">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {!consultation.parent_consultation_id && adendas.length > 0 && (
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FilePlus2 className="w-4 h-4" />
                Adendas ({adendas.length})
              </h3>
              <div className="space-y-3">
                {adendas.map((adenda) => (
                  <Link key={adenda.id} href={`/consultations/${adenda.id}`} className="block">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {adenda.chief_complaint || 'Adenda'}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(adenda.consultation_date).toLocaleDateString('es-ES', {
                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>
                      {adenda.notes && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{adenda.notes}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <User className="w-4 h-4" />
              Paciente
            </h3>
            {consultation.patient ? (
              <div className="space-y-3">
                <p className="font-medium text-slate-900 dark:text-white text-lg">
                  {consultation.patient.first_name} {consultation.patient.last_name}
                </p>
                {consultation.patient.phone && (
                  <p className="text-sm text-slate-500 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {consultation.patient.phone}
                  </p>
                )}
                {consultation.patient.blood_type && (
                  <p className="text-sm text-slate-500">Tipo sanguíneo: {consultation.patient.blood_type}</p>
                )}
                <Link href={`/patients/${consultation.patient_id}`}>
                  <Button variant="outline" className="w-full mt-2">Ver expediente</Button>
                </Link>
              </div>
            ) : (
              <p className="text-slate-500">Paciente no disponible o eliminado</p>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Información
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">ID:</span>
                <span className="text-slate-700 dark:text-slate-300 font-mono text-xs">{consultation.id.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fecha:</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {new Date(consultation.consultation_date).toLocaleDateString('es-ES')}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
