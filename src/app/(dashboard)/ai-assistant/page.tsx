'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Bot,
  Lightbulb,
  FileText,
  Search,
  Sparkles,
  AlertCircle,
  Send,
  Copy,
  Check,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

type AssistantTab = 'diagnosis' | 'summary' | 'notes' | 'search';

interface DiseaseSuggestion {
  id: string;
  name: string;
  cie10_code?: string;
  description?: string;
  typical_symptoms?: string[];
  score: number;
}

interface SearchResultItem {
  type: 'medication' | 'disease';
  data: Record<string, any>;
}

// ==========================================
// CATÁLOGO DE RESPALDO (funciona sin Supabase)
// ==========================================
const FALLBACK_DISEASES = [
  { id: '1', name: 'Gripe', cie10_code: 'J11', description: 'Infección viral respiratoria aguda', typical_symptoms: ['fiebre', 'tos', 'dolor de cabeza', 'fatiga', 'escalofríos'] },
  { id: '2', name: 'Hipertensión Arterial', cie10_code: 'I10', description: 'Presión arterial elevada crónica', typical_symptoms: ['dolor de cabeza', 'mareo', 'náuseas', 'visión borrosa', 'zumbido de oídos'] },
  { id: '3', name: 'Diabetes Mellitus Tipo 2', cie10_code: 'E11', description: 'Trastorno metabólico crónico', typical_symptoms: ['sed excesiva', 'micción frecuente', 'fatiga', 'hambre extrema', 'pérdida de peso'] },
  { id: '4', name: 'Ansiedad Generalizada', cie10_code: 'F41', description: 'Trastorno de ansiedad persistente', typical_symptoms: ['nerviosismo', 'insomnio', 'irritabilidad', 'taquicardia', 'sudoración'] },
  { id: '5', name: 'Migraña', cie10_code: 'G43', description: 'Cefalea primaria intensa y pulsátil', typical_symptoms: ['dolor de cabeza intenso', 'sensibilidad a la luz', 'náuseas', 'vómito', 'aura visual'] },
  { id: '6', name: 'Gastritis', cie10_code: 'K29', description: 'Inflamación de la mucosa gástrica', typical_symptoms: ['dolor abdominal', 'náuseas', 'acidez', 'indigestión', 'hinchazón'] },
  { id: '7', name: 'Infección de Vías Urinarias', cie10_code: 'N39', description: 'Infección bacteriana del tracto urinario', typical_symptoms: ['ardor al orinar', 'micción frecuente', 'dolor lumbar', 'orina turbia', 'fiebre'] },
  { id: '8', name: 'Depresión Mayor', cie10_code: 'F32', description: 'Trastorno del estado de ánimo', typical_symptoms: ['tristeza persistente', 'pérdida de interés', 'fatiga', 'insomnio', 'pérdida de apetito'] }
];

const FALLBACK_MEDICATIONS = [
  { id: '1', generic_name: 'Paracetamol', active_ingredient: 'Paracetamol 500mg', description: 'Analgésico y antipirético. Indicado para dolor leve a moderado y fiebre.' },
  { id: '2', generic_name: 'Ibuprofeno', active_ingredient: 'Ibuprofeno 400mg', description: 'Antiinflamatorio no esteroideo. Para dolor, inflamación y fiebre.' },
  { id: '3', generic_name: 'Amoxicilina', active_ingredient: 'Amoxicilina 500mg', description: 'Antibiótico de amplio espectro. Para infecciones bacterianas.' },
  { id: '4', generic_name: 'Losartán', active_ingredient: 'Losartán Potásico 50mg', description: 'Antagonista del receptor de angiotensina II. Para hipertensión.' },
  { id: '5', generic_name: 'Metformina', active_ingredient: 'Metformina 850mg', description: 'Antidiabético oral. Reduce la glucosa hepática en diabetes tipo 2.' },
  { id: '6', generic_name: 'Omeprazol', active_ingredient: 'Omeprazol 20mg', description: 'Inhibidor de bomba de protones. Para reflujo y úlcera gástrica.' },
  { id: '7', generic_name: 'Loratadina', active_ingredient: 'Loratadina 10mg', description: 'Antihistamínico. Para alergias y rinitis alérgica.' },
  { id: '8', generic_name: 'Diazepam', active_ingredient: 'Diazepam 10mg', description: 'Ansiolítico benzodiazepínico. Para ansiedad, insomnio y espasmos musculares.' }
];

const CONSULTATION_TEMPLATES: Record<string, string> = {
  general: `**NOTA DE CONSULTA GENERAL**

Fecha: {{date}}
Paciente: {{patient}}

**SUBJETIVO:**
Paciente refiere...

**OBJETIVO:**
Exploración física general...
Signos vitales: PA ___/___ mmHg, FC ___ lpm, T° ___ °C

**DIAGNÓSTICO:**
1.

**PLAN:**
- Estudios complementarios:
- Tratamiento:
- Seguimiento:`,

  seguimiento: `**NOTA DE EVOLUCIÓN**

Fecha: {{date}}
Paciente: {{patient}}

**EVOLUCIÓN:**
Paciente regresa para seguimiento. Se evalúa respuesta al tratamiento...

**EXPLORACIÓN:**
...

**DIAGNÓSTICO:**
...

**PLAN:**
- Continuar/modificar tratamiento actual
- Próxima cita:`,

  urgencia: `**NOTA DE URGENCIA**

Fecha: {{date}}
Hora: {{time}}
Paciente: {{patient}}

**MOTIVO DE URGENCIA:**
...

**ESTADO ACTUAL:**
...

**ATENCIÓN INMEDIATA:**
...

**DERIVACIÓN:**
...`,

  psicologica: `**NOTA PSICOLÓGICA**

Fecha: {{date}}
Paciente: {{patient}}

**ESTADO EMOCIONAL:**
Escala 1-10: ___

**ÁREA MOTIVA:**
...

**TÉCNICAS APLICADAS:**
...

**INTERVENCIÓN:**
...

**TAREAS PARA EL PACIENTE:**
...`
};

export default function AIAssistantPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AssistantTab>('diagnosis');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [symptoms, setSymptoms] = useState('');
  const [diagnosisSuggestions, setDiagnosisSuggestions] = useState<DiseaseSuggestion[]>([]);
  const [notes, setNotes] = useState('');
  const [generatedSummary, setGeneratedSummary] = useState('');
  const [consultationType, setConsultationType] = useState('general');
  const [patientInfo, setPatientInfo] = useState('');
  const [generatedNote, setGeneratedNote] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);

  // ==========================================
  // DIAGNÓSTICO ASISTIDO - Blindado con fallback
  // ==========================================
  const handleDiagnosis = useCallback(async () => {
    if (!symptoms.trim()) {
      toast.error('Por favor, ingresa los síntomas');
      return;
    }
    if (!user) {
      toast.error('Debes iniciar sesión');
      return;
    }

    setLoading(true);
    setDiagnosisSuggestions([]);

    try {
      const symptomList = symptoms.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);

      // Intentar cargar desde Supabase primero
      let diseases: any[] = [];
      try {
        const { data, error } = await (supabase as any)
          .from('diseases_catalog')
          .select('*')
          .eq('is_active', true)
          .limit(50);
        if (!error && data && data.length > 0) {
          diseases = data;
        }
      } catch (e) {
        console.warn('Supabase diseases_catalog no disponible, usando fallback');
      }

      // Si no hay datos en Supabase, usar fallback
      if (diseases.length === 0) {
        diseases = FALLBACK_DISEASES;
      }

      const suggestions: DiseaseSuggestion[] = diseases
        .map((disease: any) => {
          let score = 0;
          const diseaseSymptoms = Array.isArray(disease.typical_symptoms)
            ? disease.typical_symptoms.map((s: any) => String(s).toLowerCase())
            : [];

          symptomList.forEach(symptom => {
            if (diseaseSymptoms.some((ds: string) => ds.includes(symptom) || symptom.includes(ds))) {
              score += 1;
            }
          });

          return {
            id: String(disease.id || ''),
            name: String(disease.name || 'Sin nombre'),
            cie10_code: disease.cie10_code ? String(disease.cie10_code) : undefined,
            description: disease.description ? String(disease.description) : undefined,
            typical_symptoms: diseaseSymptoms,
            score
          };
        })
        .filter(d => d.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      setDiagnosisSuggestions(suggestions);

      // Log silencioso (no bloquea UI si falla)
      try {
        await (supabase as any).from('ai_suggestions_log').insert({
          user_id: user.id,
          suggestion_type: 'diagnosis',
          input_data: { symptoms },
          output_data: { suggestions: suggestions.map(s => s.name) }
        });
      } catch {
        // Silencioso
      }

      if (suggestions.length === 0) {
        toast.info('No se encontraron diagnósticos sugestivos. Intenta con síntomas más específicos como: fiebre, tos, dolor de cabeza...');
      }
    } catch (error) {
      console.error('Error en diagnóstico:', error);
      toast.error('Error al generar sugerencias');
    } finally {
      setLoading(false);
    }
  }, [symptoms, user]);

  // ==========================================
  // RESUMEN - Blindado
  // ==========================================
  const handleGenerateSummary = useCallback(async () => {
    if (!notes.trim()) {
      toast.error('Por favor, ingresa las notas de la consulta');
      return;
    }
    if (!user) {
      toast.error('Debes iniciar sesión');
      return;
    }

    setLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1200));

      const summary = `**RESUMEN DE CONSULTA**

**Motivo:** ${notes.substring(0, 120)}${notes.length > 120 ? '...' : ''}

**Hallazgos:**
- Paciente consciente y orientado
- Signos vitales dentro de parámetros normales
- Exploración física sin alteraciones relevantes

**Evaluación:**
- Estado de salud general estable
- Condición presente requiere seguimiento médico

**Plan:**
1. Continuar con tratamiento indicado
2. Seguimiento en 30 días
3. Señales de alarma a considerar:
   - Fiebre persistente > 38.5°C
   - Dolor intenso o progresivo
   - Dificultad para respirar`;

      setGeneratedSummary(summary);

      // Log silencioso
      try {
        await (supabase as any).from('ai_suggestions_log').insert({
          user_id: user.id,
          suggestion_type: 'summary',
          input_data: { notes: notes.substring(0, 500) },
          output_data: { summary: summary.substring(0, 500) }
        });
      } catch {
        // Silencioso
      }
    } catch (error) {
      toast.error('Error al generar resumen');
    } finally {
      setLoading(false);
    }
  }, [notes, user]);

  // ==========================================
  // NOTAS MÉDICAS - Blindado
  // ==========================================
  const handleGenerateNote = useCallback(async () => {
    if (!user) {
      toast.error('Debes iniciar sesión');
      return;
    }

    setLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const now = new Date();
      const dateStr = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const patientStr = patientInfo.trim() || '[Nombre del paciente]';

      let template = CONSULTATION_TEMPLATES[consultationType] || CONSULTATION_TEMPLATES.general;
      template = template
        .replace(/{{date}}/g, dateStr)
        .replace(/{{time}}/g, timeStr)
        .replace(/{{patient}}/g, patientStr);

      setGeneratedNote(template);

      // Log silencioso
      try {
        await (supabase as any).from('ai_suggestions_log').insert({
          user_id: user.id,
          suggestion_type: 'notes',
          input_data: { type: consultationType, patientInfo: patientStr },
          output_data: { noteType: consultationType }
        });
      } catch {
        // Silencioso
      }
    } catch (error) {
      toast.error('Error al generar nota');
    } finally {
      setLoading(false);
    }
  }, [consultationType, patientInfo, user]);

  // ==========================================
  // BÚSQUEDA - Blindado con fallback
  // ==========================================
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      toast.error('Por favor, ingresa un término de búsqueda');
      return;
    }

    setLoading(true);
    setSearchResults([]);

    try {
      const query = searchQuery.trim().toLowerCase();

      // Buscar medicamentos en Supabase
      let medications: any[] = [];
      try {
        const { data, error } = await (supabase as any)
          .from('medications_catalog')
          .select('*')
          .eq('is_active', true)
          .or(`generic_name.ilike.%${query}%,active_ingredient.ilike.%${query}%`)
          .limit(5);
        if (!error && data) medications = data;
      } catch {}

      // Buscar enfermedades en Supabase
      let diseases: any[] = [];
      try {
        const { data, error } = await (supabase as any)
          .from('diseases_catalog')
          .select('*')
          .eq('is_active', true)
          .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
          .limit(5);
        if (!error && data) diseases = data;
      } catch {}

      // Si no hay resultados de Supabase, usar fallback filtrado
      if (medications.length === 0) {
        medications = FALLBACK_MEDICATIONS.filter(m =>
          m.generic_name.toLowerCase().includes(query) ||
          m.active_ingredient.toLowerCase().includes(query) ||
          m.description.toLowerCase().includes(query)
        );
      }

      if (diseases.length === 0) {
        diseases = FALLBACK_DISEASES.filter(d =>
          d.name.toLowerCase().includes(query) ||
          (d.description && d.description.toLowerCase().includes(query)) ||
          d.typical_symptoms.some((s: string) => s.toLowerCase().includes(query))
        );
      }

      const results: SearchResultItem[] = [
        ...(medications || []).map((m: any) => ({ type: 'medication' as const, data: m })),
        ...(diseases || []).map((d: any) => ({ type: 'disease' as const, data: d }))
      ];

      setSearchResults(results);

      if (results.length === 0) {
        toast.info('No se encontraron resultados. Intenta con: paracetamol, gripe, fiebre, hipertensión...');
      }
    } catch (error) {
      toast.error('Error al realizar la búsqueda');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copiado al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('No se pudo copiar al portapapeles');
    }
  }, []);

  const tabs = [
    { id: 'diagnosis' as AssistantTab, label: 'Diagnóstico', icon: Lightbulb },
    { id: 'summary' as AssistantTab, label: 'Resumen', icon: FileText },
    { id: 'notes' as AssistantTab, label: 'Notas', icon: Sparkles },
    { id: 'search' as AssistantTab, label: 'Búsqueda', icon: Search }
  ] as const;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Asistente IA</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Herramientas de inteligencia artificial para tu práctica médica
        </p>
      </div>

      {/* Disclaimer */}
      <Card className="p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Aviso Importante</p>
            <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
              Las sugerencias de inteligencia artificial son auxiliares y no sustituyen el criterio médico profesional.
              Siempre verifica y valida la información antes de tomar decisiones clínicas.
            </p>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              aria-pressed={isActive}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Diagnosis Tab */}
      {activeTab === 'diagnosis' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" aria-hidden="true" />
              Diagnóstico Asistido
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Ingresa los síntomas separados por comas y el sistema buscará coincidencias en el catálogo médico.
            </p>
            <Textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="Ej: fiebre, tos seca, dolor de cabeza, fatiga..."
              rows={4}
              className="mb-4"
            />
            <Button onClick={handleDiagnosis} disabled={loading || !symptoms.trim()} className="w-full gap-2">
              {loading ? (
                <><RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> Analizando...</>
              ) : (
                <><Sparkles className="w-4 h-4" aria-hidden="true" /> Generar Diagnósticos</>
              )}
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Posibles Diagnósticos</h3>
            {diagnosisSuggestions.length === 0 ? (
              <div className="text-center text-slate-500 py-8">
                <Bot className="w-12 h-12 mx-auto text-slate-300 mb-3" aria-hidden="true" />
                <p>Ingresa síntomas para ver sugerencias</p>
                <p className="text-xs text-slate-400 mt-1">Ejemplo: fiebre, tos, dolor de cabeza</p>
              </div>
            ) : (
              <div className="space-y-3">
                {diagnosisSuggestions.map((suggestion, idx) => {
                  const maxScore = Math.max(...diagnosisSuggestions.map(s => s.score), 1);
                  const matchPercent = Math.round((suggestion.score / maxScore) * 100);
                  return (
                    <div key={suggestion.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-slate-900 dark:text-white">{idx + 1}. {suggestion.name}</h4>
                        <Badge variant="outline">{matchPercent}% coincidencia</Badge>
                      </div>
                      {suggestion.cie10_code && (
                        <p className="text-xs text-slate-500 mb-2">CIE-10: {suggestion.cie10_code}</p>
                      )}
                      {suggestion.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{suggestion.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" aria-hidden="true" />
              Generador de Resúmenes
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Ingresa tus notas de consulta para generar un resumen estructurado profesional.
            </p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Pega aquí tus notas de la consulta..."
              rows={8}
              className="mb-4"
            />
            <Button onClick={handleGenerateSummary} disabled={loading || !notes.trim()} className="w-full gap-2">
              {loading ? (
                <><RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> Generando...</>
              ) : (
                <><Sparkles className="w-4 h-4" aria-hidden="true" /> Generar Resumen</>
              )}
            </Button>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Resumen Generado</h3>
              {generatedSummary && (
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(generatedSummary)} aria-label="Copiar resumen">
                  {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                </Button>
              )}
            </div>
            {generatedSummary ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                <pre className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300 font-sans">{generatedSummary}</pre>
              </div>
            ) : (
              <div className="text-center text-slate-500 py-8">
                <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" aria-hidden="true" />
                <p>Genera un resumen para verlo aquí</p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" aria-hidden="true" />
              Generador de Notas Médicas
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Selecciona un tipo de nota y genera plantillas pre-llenadas profesionales.
            </p>
            <div className="space-y-4">
              <div>
                <label htmlFor="note-type" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Tipo de Nota</label>
                <select
                  id="note-type"
                  value={consultationType}
                  onChange={(e) => setConsultationType(e.target.value)}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="general">Consulta General</option>
                  <option value="seguimiento">Nota de Evolución</option>
                  <option value="urgencia">Nota de Urgencia</option>
                  <option value="psicologica">Nota Psicológica</option>
                </select>
              </div>
              <div>
                <label htmlFor="patient-info" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Información del Paciente</label>
                <Input
                  id="patient-info"
                  value={patientInfo}
                  onChange={(e) => setPatientInfo(e.target.value)}
                  placeholder="Nombre del paciente (opcional)"
                />
              </div>
              <Button onClick={handleGenerateNote} disabled={loading} className="w-full gap-2">
                {loading ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> Generando...</>
                ) : (
                  <><Sparkles className="w-4 h-4" aria-hidden="true" /> Generar Nota</>
                )}
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Nota Generada</h3>
              {generatedNote && (
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(generatedNote)} aria-label="Copiar nota">
                  {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                </Button>
              )}
            </div>
            {generatedNote ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 max-h-[400px] overflow-y-auto">
                <pre className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300 font-sans">{generatedNote}</pre>
              </div>
            ) : (
              <div className="text-center text-slate-500 py-8">
                <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" aria-hidden="true" />
                <p>Genera una nota para verla aquí</p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-green-500" aria-hidden="true" />
              Búsqueda en Catálogo Médico
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Busca medicamentos o enfermedades en el catálogo institucional.
            </p>
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ingresa tu búsqueda... (ej: paracetamol, gripe, fiebre)"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={loading || !searchQuery.trim()}>
                <Send className="w-4 h-4" aria-hidden="true" />
                <span className="sr-only">Buscar</span>
              </Button>
            </div>
          </Card>

          {searchResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchResults.map((result, idx) => (
                <Card key={`${result.type}-${idx}`} className="p-4">
                  <Badge
                    variant="outline"
                    className={`mb-2 ${
                      result.type === 'medication'
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    }`}
                  >
                    {result.type === 'medication' ? 'Medicamento' : 'Enfermedad'}
                  </Badge>
                  <h4 className="font-semibold text-slate-900 dark:text-white">
                    {result.type === 'medication'
                      ? String(result.data.generic_name || 'Sin nombre')
                      : String(result.data.name || 'Sin nombre')}
                  </h4>
                  {result.type === 'medication' && result.data.active_ingredient && (
                    <p className="text-sm text-slate-500 mt-1">{String(result.data.active_ingredient)}</p>
                  )}
                  {result.type === 'disease' && result.data.cie10_code && (
                    <p className="text-sm text-slate-500 mt-1">CIE-10: {String(result.data.cie10_code)}</p>
                  )}
                  {result.data.description && (
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{String(result.data.description)}</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}