'use client';

import { useState } from 'react';
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

export default function AIAssistantPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AssistantTab>('diagnosis');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Diagnosis state
  const [symptoms, setSymptoms] = useState('');
  const [diagnosisSuggestions, setDiagnosisSuggestions] = useState<any[]>([]);

  // Summary state
  const [notes, setNotes] = useState('');
  const [generatedSummary, setGeneratedSummary] = useState('');

  // Notes generator state
  const [consultationType, setConsultationType] = useState('general');
  const [patientInfo, setPatientInfo] = useState('');
  const [generatedNote, setGeneratedNote] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const handleDiagnosis = async () => {
    if (!symptoms.trim()) {
      toast.error('Por favor, ingresa los síntomas');
      return;
    }
    setLoading(true);

    try {
      // Simulate AI diagnosis based on symptoms
      const symptomList = symptoms.toLowerCase().split(',').map(s => s.trim());

      const { data: diseases } = await supabase
        .from('diseases_catalog')
        .select('*')
        .eq('is_active', true)
        .limit(20);

      const suggestions = diseases?.map(disease => {
        let score = 0;
        const diseaseSymptoms = disease.typical_symptoms?.map((s: string) => s.toLowerCase()) || [];
        symptomList.forEach(symptom => {
          if (diseaseSymptoms.some((ds: string) => ds.includes(symptom) || symptom.includes(ds))) {
            score += 1;
          }
        });
        return { ...disease, score };
      })
        .filter(d => d.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5) || [];

      setDiagnosisSuggestions(suggestions);

      // Log the suggestion
      await supabase.from('ai_suggestions_log').insert({
        user_id: user?.id,
        suggestion_type: 'diagnosis',
        input_data: { symptoms },
        output_data: { suggestions: suggestions.map(s => s.name) }
      });

      if (suggestions.length === 0) {
        toast.info('No se encontraron diagnósticos suggestivos para los síntomas ingresados');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al generar sugerencias');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!notes.trim()) {
      toast.error('Por favor, ingresa las notas de la consulta');
      return;
    }
    setLoading(true);

    try {
      // Simulate AI summary generation
      await new Promise(resolve => setTimeout(resolve, 1500));

      const summary = `**RESUMEN DE CONSULTA**

**Motivo:** ${notes.substring(0, 100)}...

**Hallazgos:**
- Paciente consciente y orientado
- Signos vitales dentro de parámetros normales
- Exploración física sin alteraciones relevantes

**Evaluación:**
- Estado de salud general estable
- Condición presente requiere seguimiento

**Plan:**
1. Continuar con tratamiento indicado
2. Seguimiento en 30 días
3. Señales de alarma a considerar`;

      setGeneratedSummary(summary);

      await supabase.from('ai_suggestions_log').insert({
        user_id: user?.id,
        suggestion_type: 'summary',
        input_data: { notes },
        output_data: { summary }
      });
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al generar resumen');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateNote = async () => {
    setLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const templates: Record<string, string> = {
        general: `**NOTA DE CONSULTA GENERAL**

Fecha: ${new Date().toLocaleDateString('es-ES')}
Paciente: ${patientInfo || '[Nombre del paciente]'}

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

Fecha: ${new Date().toLocaleDateString('es-ES')}
Paciente: ${patientInfo || '[Nombre del paciente]'}

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

Fecha: ${new Date().toLocaleDateString('es-ES')}
Hora: ${new Date().toLocaleTimeString('es-ES')}
Paciente: ${patientInfo || '[Nombre del paciente]'}

**MOTIVO DE URGENCIA:**
...

**ESTADO ACTUAL:**
...

**ATENCIÓN INMEDIATA:**
...

**DERIVACIÓN:**
...`,

        psicologica: `**NOTA PSICOLÓGICA**

Fecha: ${new Date().toLocaleDateString('es-ES')}
Paciente: ${patientInfo || '[Nombre del paciente]'}

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

      setGeneratedNote(templates[consultationType] || templates.general);

      await supabase.from('ai_suggestions_log').insert({
        user_id: user?.id,
        suggestion_type: 'notes',
        input_data: { type: consultationType, patientInfo },
        output_data: { note: templates[consultationType] }
      });
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al generar nota');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Por favor, ingresa una búsqueda');
      return;
    }
    setLoading(true);

    try {
      const { data: medications } = await supabase
        .from('medications_catalog')
        .select('*')
        .eq('is_active', true)
        .or(`generic_name.ilike.%${searchQuery}%,active_ingredient.ilike.%${searchQuery}%`)
        .limit(5);

      const { data: diseases } = await supabase
        .from('diseases_catalog')
        .select('*')
        .eq('is_active', true)
        .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .limit(5);

      setSearchResults([
        ...(medications?.map(m => ({ type: 'medication', data: m })) || []),
        ...(diseases?.map(d => ({ type: 'disease', data: d })) || [])
      ]);

      if (!medications?.length && !diseases?.length) {
        toast.info('No se encontraron resultados');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error en la búsqueda');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copiado al portapapeles');
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs = [
    { id: 'diagnosis', label: 'Diagnóstico', icon: Lightbulb },
    { id: 'summary', label: 'Resumen', icon: FileText },
    { id: 'notes', label: 'Notas', icon: Sparkles },
    { id: 'search', label: 'Búsqueda', icon: Search }
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Asistente IA</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Herramientas de inteligencia artificial para ayudarte en tu práctica médica
        </p>
      </div>

      {/* Disclaimer */}
      <Card className="p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
              Aviso Importante
            </p>
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
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
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
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              Diagnóstico Asistido
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Ingresa los síntomas separados por comas y la IA te sugerirá posibles diagnósticos.
            </p>
            <Textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="Ej: fiebre, tos seca, dolor de cabeza, fatiga..."
              rows={4}
              className="mb-4"
            />
            <Button onClick={handleDiagnosis} disabled={loading} className="w-full gap-2">
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Analizando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generar Diagnósticos
                </>
              )}
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Posibles Diagnósticos
            </h3>
            {diagnosisSuggestions.length === 0 ? (
              <p className="text-center text-slate-500 py-8">
                Ingresa síntomas para ver sugerencias
              </p>
            ) : (
              <div className="space-y-3">
                {diagnosisSuggestions.map((suggestion, idx) => (
                  <div
                    key={suggestion.id}
                    className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-slate-900 dark:text-white">
                        {suggestion.name}
                      </h4>
                      <Badge variant="outline">
                        {Math.round((suggestion.score / Math.max(...diagnosisSuggestions.map(s => s.score))) * 100)}% match
                      </Badge>
                    </div>
                    {suggestion.cie10_code && (
                      <p className="text-xs text-slate-500 mb-2">CIE-10: {suggestion.cie10_code}</p>
                    )}
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {suggestion.description?.substring(0, 100)}...
                    </p>
                  </div>
                ))}
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
              <FileText className="w-5 h-5 text-blue-500" />
              Generador de Resúmenes
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Ingresa tus notas de consulta y la IA generará un resumen estructurado.
            </p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Pega aquí tus notas de la consulta..."
              rows={8}
              className="mb-4"
            />
            <Button onClick={handleGenerateSummary} disabled={loading} className="w-full gap-2">
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generar Resumen
                </>
              )}
            </Button>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Resumen Generado
              </h3>
              {generatedSummary && (
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(generatedSummary)}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              )}
            </div>
            {generatedSummary ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <pre className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300 font-sans">
                  {generatedSummary}
                </pre>
              </div>
            ) : (
              <p className="text-center text-slate-500 py-8">
                Genera un resumen para verlo aquí
              </p>
            )}
          </Card>
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Generador de Notas Médicas
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Selecciona un tipo de nota y genera plantillas pre-llenadas.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                  Tipo de Nota
                </label>
                <select
                  value={consultationType}
                  onChange={(e) => setConsultationType(e.target.value)}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
                >
                  <option value="general">Consulta General</option>
                  <option value="seguimiento">Nota de Evolución</option>
                  <option value="urgencia">Nota de Urgencia</option>
                  <option value="psicologica">Nota Psicológica</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                  Información del Paciente
                </label>
                <Input
                  value={patientInfo}
                  onChange={(e) => setPatientInfo(e.target.value)}
                  placeholder="Nombre del paciente (opcional)"
                />
              </div>

              <Button onClick={handleGenerateNote} disabled={loading} className="w-full gap-2">
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generar Nota
                  </>
                )}
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Nota Generada
              </h3>
              {generatedNote && (
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(generatedNote)}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              )}
            </div>
            {generatedNote ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg max-h-[400px] overflow-y-auto">
                <pre className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300 font-sans">
                  {generatedNote}
                </pre>
              </div>
            ) : (
              <p className="text-center text-slate-500 py-8">
                Genera una nota para verla aquí
              </p>
            )}
          </Card>
        </div>
      )}

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-green-500" />
              Búsqueda Inteligente
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Busca medicamentos o enfermedades en el catálogo.
            </p>
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ingresa tu búsqueda..."
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={loading}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </Card>

          {searchResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchResults.map((result, idx) => (
                <Card key={idx} className="p-4">
                  <Badge
                    variant="outline"
                    className={`mb-2 ${
                      result.type === 'medication'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-green-50 text-green-700'
                    }`}
                  >
                    {result.type === 'medication' ? 'Medicamento' : 'Enfermedad'}
                  </Badge>
                  <h4 className="font-semibold text-slate-900 dark:text-white">
                    {result.type === 'medication' ? result.data.generic_name : result.data.name}
                  </h4>
                  {result.type === 'medication' && result.data.active_ingredient && (
                    <p className="text-sm text-slate-500 mt-1">
                      {result.data.active_ingredient}
                    </p>
                  )}
                  {result.type === 'disease' && result.data.cie10_code && (
                    <p className="text-sm text-slate-500 mt-1">
                      CIE-10: {result.data.cie10_code}
                    </p>
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
