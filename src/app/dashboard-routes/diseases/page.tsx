'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Stethoscope,
  Search,
  AlertTriangle,
  Info,
  X
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import type { Disease } from '@/lib/types';

const categoryColors: Record<string, string> = {
  viral: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  bacterial: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  chronic: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  cardiovascular: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
  respiratory: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  digestive: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  neurological: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  psychological: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  dermatological: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  oncological: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  endocrine: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  musculoskeletal: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  other: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400'
};

const categoryLabels: Record<string, string> = {
  viral: 'Viral',
  bacterial: 'Bacteriana',
  chronic: 'Crónica',
  cardiovascular: 'Cardiovascular',
  respiratory: 'Respiratoria',
  digestive: 'Digestiva',
  neurological: 'Neurológica',
  psychological: 'Psicológica',
  dermatological: 'Dermatológica',
  oncological: 'Oncológica',
  endocrine: 'Endocrina',
  musculoskeletal: 'Musculoesquelética',
  other: 'Otra'
};

export default function DiseasesPage() {
  const { user } = useAuth();
  const [diseases, setDiseases] = useState<Disease[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedDisease, setSelectedDisease] = useState<Disease | null>(null);

  useEffect(() => {
    fetchDiseases();
  }, [search, categoryFilter]);

  const fetchDiseases = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('diseases_catalog')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDiseases(data || []);
    } catch (error) {
      console.error('Error fetching diseases:', error);
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Enfermedades</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Catálogo de enfermedades y diagnósticos
          </p>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar por nombre o descripción..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">Todas las categorías</option>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </Card>

      {diseases.length === 0 ? (
        <Card className="p-12 text-center">
          <Stethoscope className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            No hay enfermedades
          </h3>
          <p className="text-slate-500 dark:text-slate-400">
            El catálogo está vacío
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {diseases.map((disease) => (
            <Card
              key={disease.id}
              className="p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedDisease(disease)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Stethoscope className="w-5 h-5 text-blue-600" />
                </div>
                <Badge className={categoryColors[disease.category] || categoryColors.other}>
                  {categoryLabels[disease.category] || disease.category}
                </Badge>
              </div>

              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                {disease.name}
              </h3>

              {disease.cie10_code && (
                <p className="text-xs text-slate-500 mb-2">CIE-10: {disease.cie10_code}</p>
              )}

              {disease.description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                  {disease.description}
                </p>
              )}

              {disease.typical_symptoms && disease.typical_symptoms.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {disease.typical_symptoms.slice(0, 3).map((symptom, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {symptom}
                    </Badge>
                  ))}
                  {disease.typical_symptoms.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{disease.typical_symptoms.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Disease Detail Modal */}
      <Dialog open={!!selectedDisease} onOpenChange={() => setSelectedDisease(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Stethoscope className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <span className="text-xl">{selectedDisease?.name}</span>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={categoryColors[selectedDisease?.category || 'other']}>
                    {categoryLabels[selectedDisease?.category || 'other']}
                  </Badge>
                  {selectedDisease?.cie10_code && (
                    <Badge variant="outline">CIE-10: {selectedDisease.cie10_code}</Badge>
                  )}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedDisease && (
            <div className="space-y-6 max-h-[60vh] overflow-y-auto">
              {selectedDisease.description && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Descripción</p>
                  <p className="text-slate-700 dark:text-slate-300">{selectedDisease.description}</p>
                </div>
              )}

              {selectedDisease.typical_symptoms && selectedDisease.typical_symptoms.length > 0 && (
                <div>
                  <p className="text-sm text-slate-500 mb-2 flex items-center gap-1">
                    <Info className="w-4 h-4" />
                    Síntomas Típicos
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedDisease.typical_symptoms.map((symptom, idx) => (
                      <Badge key={idx} variant="outline">{symptom}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedDisease.etiology && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Etiología / Causas</p>
                  <p className="text-slate-700 dark:text-slate-300">{selectedDisease.etiology}</p>
                </div>
              )}

              {selectedDisease.treatment && (
                <div>
                  <p className="text-sm text-slate-500 mb-2 flex items-center gap-1">
                    <Stethoscope className="w-4 h-4" />
                    Tratamiento
                  </p>
                  <p className="text-slate-700 dark:text-slate-300">{selectedDisease.treatment}</p>
                </div>
              )}

              {selectedDisease.complications && (
                <div>
                  <p className="text-sm text-slate-500 mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    Complicaciones
                  </p>
                  <p className="text-slate-700 dark:text-slate-300">{selectedDisease.complications}</p>
                </div>
              )}

              {selectedDisease.prevention && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Prevención</p>
                  <p className="text-slate-700 dark:text-slate-300">{selectedDisease.prevention}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
