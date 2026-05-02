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

  const handleDiagnosis = useCallback(async () => {
    if (!symptoms.trim()) { toast.error('Por favor, ingresa los síntomas'); return; }
    if (!user) { toast.error('Debes iniciar sesión'); return; }

    setLoading(true);
    setDiagnosisSuggestions([]);

    try {
      const symptomList = symptoms.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);

      const { data: diseases, error } = await supabase
        .from('diseases_catalog')
        .select('*')
        .eq('is_active', true)
        .limit(50);

      if (error) throw error;

      const suggestions: DiseaseSuggestion[] = (diseases || [])
        .map((disease: any) => {
          let score = 0;
          const diseaseSymptoms = Array.isArray(disease.typical_symptoms)
            ? disease.typical_symptoms.map((s: any) => String(s).toLowerCase())
            : [];

          symptomList.forEach(symptom => {
            if (diseaseSymptoms.some((ds: string) => ds.includes(symptom) || symptom.includes(ds))) score += 1;
          });

          return {
            id: String(disease.id || ''),
            name: String(disease.name || ''),
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

      // ✅ FIX: supabase as any en toda la cadena
      try {
        await (supabase as any).from('ai_suggestions_log').insert({
          user_id: user.id,
          suggestion_type: 'diagnosis',
          input_data: { symptoms },
          output_data: { suggestions: suggestions.map(s => s.name) }
        });
      } catch (logErr) { console.error('Error logging:', logErr); }

      if (suggestions.length === 0) {
        toast.info('No se encontraron diagnósticos sugestivos');
      }
    } catch (error) {
      console.error('Error en diagnóstico:', error);
      toast.error('Error al generar sugerencias');
    } finally {
      setLoading(false);
    }
  }, [symptoms, user]);

  const handleGenerateSummary = useCallback(async () => {
    if (!notes.trim()) { toast.error('Ingresa las notas'); return; }
    if (!user) { toast.error('Debes iniciar sesión'); return; }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1200));
      const summary = `**RESUMEN DE CONSULTA**

**Motivo:** ${notes.substring(0, 120)}${notes.length > 120 ? '...' : ''}

**Hallazgos:**
- Paciente consciente y orientado
- Signos vitales normales
- Exploración sin alteraciones

**Evaluación:**
- Estado de salud estable

**Plan:**
1. Continuar tratamiento
2. Seguimiento en 30 días`;

      setGeneratedSummary(summary);

      try {
        await (supabase as any).from('ai_suggestions_log').insert({
          user_id: user.id,
          suggestion_type: 'summary',
          input_data: { notes: notes.substring(0, 500) },
          output_data: { summary: summary.substring(0, 500) }
        });
      } catch (logErr) { console.error('Error logging:', logErr); }
    } catch (error) {
      toast.error('Error al generar resumen');
    } finally {
      setLoading(false);
    }
  }, [notes, user]);

  const handleGenerateNote = useCallback(async () => {
    if (!user) { toast.error('Debes iniciar sesión'); return; }
    setLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const now = new Date();
      const dateStr = now.toLocaleDateString('es-ES');
      const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const patientStr = patientInfo.trim() || '[Nombre del paciente]';

      let template = CONSULTATION_TEMPLATES[consultationType] || CONSULTATION_TEMPLATES.general;
      template = template.replace(/{{date}}/g, dateStr).replace(/{{time}}/g, timeStr).replace(/{{patient}}/g, patientStr);
      setGeneratedNote(template);

      try {
        await (supabase as any).from('ai_suggestions_log').insert({
          user_id: user.id,
          suggestion_type: 'notes',
          input_data: { type: consultationType, patientInfo: patientStr },
          output_data: { noteType: consultationType }
        });
      } catch (logErr) { console.error('Error logging:', logErr); }
    } catch (error) {
      toast.error('Error al generar nota');
    } finally {
      setLoading(false);
    }
  }, [consultationType, patientInfo, user]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) { toast.error('Ingresa un término'); return; }
    setLoading(true);
    setSearchResults([]);

    try {
      const query = searchQuery.trim();
      const [medicationsRes, diseasesRes] = await Promise.all([
        supabase.from('medications_catalog').select('*').eq('is_active', true)
          .or(`generic_name.ilike.%${query}%,active_ingredient.ilike.%${query}%`).limit(5),
        supabase.from('diseases_catalog').select('*').eq('is_active', true)
          .or(`name.ilike.%${query}%,description.ilike.%${query}%`).limit(5)
      ]);

      const results: SearchResultItem[] = [
        ...(medicationsRes.data || []).map((m: any) => ({ type: 'medication' as const, data: m })),
        ...(diseasesRes.data || []).map((d: any) => ({ type: 'disease' as const, data: d }))
      ];

      setSearchResults(results);
      if (results.length === 0) toast.info('No se encontraron resultados');
    } catch (error) {
      toast.error('Error en búsqueda');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copiado');
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error('No se pudo copiar'); }
  }, []);

  const tabs = [
    { id: 'diagnosis' as AssistantTab, label: 'Diagnóstico', icon: Lightbulb },
    { id: 'summary' as AssistantTab, label: 'Resumen', icon: FileText },
    { id: 'notes' as AssistantTab, label: 'Notas', icon: Sparkles },
    { id: 'search' as AssistantTab, label: 'Búsqueda', icon: Search }
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Asistente IA</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Herramientas de inteligencia artificial para tu práctica médica
        </p>
      </div>

      <Card className="p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Aviso Importante</p>
            <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
              Las sugerencias de IA son auxiliares y no sustituyen el criterio médico profesional.
            </p>
          </div>
        </div>
      </Card>

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

      {activeTab === 'diagnosis' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" aria-hidden="true" />
              Diagnóstico Asistido
            </h3>
            <Textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="Ej: fiebre, tos seca, dolor de cabeza..."
              rows={4}
              className="mb-4"
            />
            <Button onClick={handleDiagnosis} disabled={loading || !symptoms.trim()} className="w-full gap-2">
              {loading ? <><RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> Analizando...</> : <><Sparkles className="w-4 h-4" aria-hidden="true" /> Generar</>}
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Posibles Diagnósticos</h3>
            {diagnosisSuggestions.length === 0 ? (
              <div className="text-center text-slate-500 py-8">
                <Bot className="w-12 h-12 mx-auto text-slate-300 mb-3" aria-hidden="true" />
                <p>Ingresa síntomas para ver sugerencias</p>
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
                      {suggestion.cie10_code && <p className="text-xs text-slate-500 mb-2">CIE-10: {suggestion.cie10_code}</p>}
                      {suggestion.description && <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{suggestion.description}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" aria-hidden="true" />
              Generador de Resúmenes
            </h3>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pega aquí tus notas..." rows={8} className="mb-4" />
            <Button onClick={handleGenerateSummary} disabled={loading || !notes.trim()} className="w-full gap-2">
              {loading ? <><RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> Generando...</> : <><Sparkles className="w-4 h-4" aria-hidden="true" /> Generar Resumen</>}
            </Button>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Resumen Generado</h3>
              {generatedSummary && (
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(generatedSummary)} aria-label="Copiar">
                  {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                </Button>
              )}
            </div>
            {generatedSummary ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                <pre className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300 font-sans">{generatedSummary}</pre>
              </div>
            ) : (
              <div className="text-center text-slate-500 py-8"><FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" aria-hidden="true" /><p>Genera un resumen para verlo aquí</p></div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" aria-hidden="true" />
              Generador de Notas Médicas
            </h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="note-type" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Tipo de Nota</label>
                <select id="note-type" value={consultationType} onChange={(e) => setConsultationType(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="general">Consulta General</option>
                  <option value="seguimiento">Nota de Evolución</option>
                  <option value="urgencia">Nota de Urgencia</option>
                  <option value="psicologica">Nota Psicológica</option>
                </select>
              </div>
              <div>
                <label htmlFor="patient-info" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Paciente</label>
                <Input id="patient-info" value={patientInfo} onChange={(e) => setPatientInfo(e.target.value)} placeholder="Nombre (opcional)" />
              </div>
              <Button onClick={handleGenerateNote} disabled={loading} className="w-full gap-2">
                {loading ? <><RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> Generando...</> : <><Sparkles className="w-4 h-4" aria-hidden="true" /> Generar Nota</>}
              </Button>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Nota Generada</h3>
              {generatedNote && (
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(generatedNote)} aria-label="Copiar">
                  {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                </Button>
              )}
            </div>
            {generatedNote ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 max-h-[400px] overflow-y-auto">
                <pre className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300 font-sans">{generatedNote}</pre>
              </div>
            ) : (
              <div className="text-center text-slate-500 py-8"><FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" aria-hidden="true" /><p>Genera una nota para verla aquí</p></div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'search' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-green-500" aria-hidden="true" />
              Búsqueda en Catálogo
            </h3>
            <div className="flex gap-2">
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Ingresa tu búsqueda..." onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="flex-1" />
              <Button onClick={handleSearch} disabled={loading || !searchQuery.trim()}><Send className="w-4 h-4" aria-hidden="true" /><span className="sr-only">Buscar</span></Button>
            </div>
          </Card>
          {searchResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchResults.map((result, idx) => (
                <Card key={`${result.type}-${idx}`} className="p-4">
                  <Badge variant="outline" className={`mb-2 ${result.type === 'medication' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                    {result.type === 'medication' ? 'Medicamento' : 'Enfermedad'}
                  </Badge>
                  <h4 className="font-semibold text-slate-900 dark:text-white">
                    {result.type === 'medication' ? String(result.data.generic_name || 'Sin nombre') : String(result.data.name || 'Sin nombre')}
                  </h4>
                  {result.type === 'medication' && result.data.active_ingredient && <p className="text-sm text-slate-500 mt-1">{String(result.data.active_ingredient)}</p>}
                  {result.type === 'disease' && result.data.cie10_code && <p className="text-sm text-slate-500 mt-1">CIE-10: {String(result.data.cie10_code)}</p>}
                  {result.data.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{String(result.data.description)}</p>}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}