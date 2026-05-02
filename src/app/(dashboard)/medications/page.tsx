'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Pill,
  Search,
  Plus,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import type { Medication } from '@/lib/types';

export default function MedicationsPage() {
  const { user } = useAuth();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const pageSize = 12;

  useEffect(() => {
    fetchMedications();
  }, [search]);

  const fetchMedications = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('medications_catalog')
        .select('*')
        .eq('is_active', true)
        .order('generic_name');

      if (search) {
        query = query.or(`generic_name.ilike.%${search}%,active_ingredient.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMedications(data || []);
    } catch (error) {
      console.error('Error fetching medications:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(medications.length / pageSize);
  const paginatedMedications = medications.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Medicamentos</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Catálogo de medicamentos disponibles
          </p>
        </div>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Buscar por nombre, principio activo..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
          />
        </div>
      </Card>

      {medications.length === 0 ? (
        <Card className="p-12 text-center">
          <Pill className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            No hay medicamentos
          </h3>
          <p className="text-slate-500 dark:text-slate-400">
            El catálogo está vacío
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedMedications.map((med) => (
              <Card
                key={med.id}
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedMedication(med)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Pill className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                      {med.generic_name}
                    </h3>
                    {med.active_ingredient && (
                      <p className="text-sm text-slate-500 truncate">{med.active_ingredient}</p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {med.routes?.slice(0, 2).map((route, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {route}
                    </Badge>
                  ))}
                  {med.pharmacological_group && (
                    <Badge variant="outline" className="text-xs">
                      {med.pharmacological_group}
                    </Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Mostrando {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, medications.length)} de {medications.length}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Medication Detail Modal */}
      <Dialog open={!!selectedMedication} onOpenChange={() => setSelectedMedication(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Pill className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <span className="text-xl">{selectedMedication?.generic_name}</span>
                {selectedMedication?.brand_names && selectedMedication.brand_names.length > 0 && (
                  <p className="text-sm font-normal text-slate-500">
                    {selectedMedication.brand_names.join(', ')}
                  </p>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedMedication && (
            <div className="space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                {selectedMedication.active_ingredient && (
                  <div>
                    <p className="text-sm text-slate-500">Principio Activo</p>
                    <p className="font-medium">{selectedMedication.active_ingredient}</p>
                  </div>
                )}
                {selectedMedication.pharmacological_group && (
                  <div>
                    <p className="text-sm text-slate-500">Grupo Farmacológico</p>
                    <p className="font-medium">{selectedMedication.pharmacological_group}</p>
                  </div>
                )}
              </div>

              {/* Forms & Routes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-2">Formas Farmacéuticas</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedMedication.dosage_forms?.map((form, idx) => (
                      <Badge key={idx}>{form}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-2">Vías de Administración</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedMedication.routes?.map((route, idx) => (
                      <Badge key={idx}>{route}</Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Indications */}
              {selectedMedication.indications && (
                <div>
                  <p className="text-sm text-slate-500 mb-2 flex items-center gap-1">
                    <Info className="w-4 h-4" />
                    Indicaciones
                  </p>
                  <p className="text-slate-700 dark:text-slate-300">{selectedMedication.indications}</p>
                </div>
              )}

              {/* Contraindications */}
              {selectedMedication.contraindications && (
                <div>
                  <p className="text-sm text-slate-500 mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Contraindicaciones
                  </p>
                  <p className="text-slate-700 dark:text-slate-300">{selectedMedication.contraindications}</p>
                </div>
              )}

              {/* Side Effects */}
              {selectedMedication.side_effects && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Efectos Adversos</p>
                  <p className="text-slate-700 dark:text-slate-300">{selectedMedication.side_effects}</p>
                </div>
              )}

              {/* Precautions */}
              {selectedMedication.precautions && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Precauciones</p>
                  <p className="text-slate-700 dark:text-slate-300">{selectedMedication.precautions}</p>
                </div>
              )}

              {/* Interactions */}
              {selectedMedication.interactions && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Interacciones</p>
                  <p className="text-slate-700 dark:text-slate-300">{selectedMedication.interactions}</p>
                </div>
              )}

              {/* Storage */}
              {selectedMedication.storage && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Almacenamiento</p>
                  <p className="text-slate-700 dark:text-slate-300">{selectedMedication.storage}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
