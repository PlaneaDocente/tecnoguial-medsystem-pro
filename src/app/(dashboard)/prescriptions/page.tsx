'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SignaturePad } from '@/components/ui/signature-pad';
import {
  FileText,
  Plus,
  Search,
  Download,
  Trash2,
  Pill,
  X,
  User,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { generatePrescription, downloadPDF, PrescriptionItem } from '@/lib/pdf-generator';
import type { Patient, Medication } from '@/lib/types';

interface PrescriptionItemForm {
  medication_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  observations: string;
}

export default function PrescriptionsPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [doctorSignature, setDoctorSignature] = useState<string | null>(null);
  const [doctorLicense, setDoctorLicense] = useState<string>('');

  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItemForm[]>([
    { medication_id: '', medication_name: '', dosage: '', frequency: '', duration: '', route: 'oral', observations: '' }
  ]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchDoctorProfile();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const [patientsRes, medsRes] = await Promise.all([
        supabase.from('patients').select('*').eq('user_id', user.id).order('last_name'),
        supabase.from('medications_catalog').select('*').eq('is_active', true).order('generic_name')
      ]);

      setPatients(patientsRes.data || []);
      setMedications(medsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctorProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('license_number')
      .eq('id', user.id)
      .single();

    if (data?.license_number) {
      setDoctorLicense(data.license_number);
    }
  };

  const filteredPatients = patients.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    p.phone?.includes(search)
  );

  const addPrescriptionItem = () => {
    setPrescriptionItems([
      ...prescriptionItems,
      { medication_id: '', medication_name: '', dosage: '', frequency: '', duration: '', route: 'oral', observations: '' }
    ]);
  };

  const removePrescriptionItem = (index: number) => {
    if (prescriptionItems.length > 1) {
      setPrescriptionItems(prescriptionItems.filter((_, i) => i !== index));
    }
  };

  const updatePrescriptionItem = (index: number, field: keyof PrescriptionItemForm, value: string) => {
    const updated = [...prescriptionItems];
    updated[index] = { ...updated[index], [field]: value };
    setPrescriptionItems(updated);
  };

  const handleMedicationSelect = (index: number, medicationId: string) => {
    const medication = medications.find(m => m.id === medicationId);
    if (medication) {
      updatePrescriptionItem(index, 'medication_id', medicationId);
      updatePrescriptionItem(index, 'medication_name', medication.generic_name);
    }
  };

  const handleSaveSignature = (signatureDataUrl: string) => {
    setDoctorSignature(signatureDataUrl);
    setShowSignaturePad(false);
    toast.success('Firma guardada');
  };

  const handleGeneratePrescription = () => {
    if (!selectedPatient || prescriptionItems.length === 0) {
      toast.error('Selecciona un paciente y agrega medicamentos');
      return;
    }

    toast.promise(async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user?.id)
        .single();

      const { data: settings } = await supabase
        .from('clinic_settings')
        .select('clinic_name')
        .eq('user_id', user?.id)
        .maybeSingle();

      const prescriptions: PrescriptionItem[] = prescriptionItems
        .filter(item => item.medication_name)
        .map(item => ({
          medication_name: item.medication_name,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          route: item.route,
          observations: item.observations
        }));

      if (prescriptions.length === 0) {
        throw new Error('Agrega al menos un medicamento');
      }

      const doc = generatePrescription(
        {
          first_name: selectedPatient.first_name,
          last_name: selectedPatient.last_name,
          phone: selectedPatient.phone,
          birth_date: selectedPatient.birth_date,
          blood_type: selectedPatient.blood_type
        },
        prescriptions,
        profile?.full_name || 'Doctor',
        doctorLicense || undefined,
        settings?.clinic_name || undefined,
        doctorSignature || undefined
      );

      downloadPDF(doc, `receta_${selectedPatient.last_name}_${new Date().toISOString().split('T')[0]}.pdf`);

      setShowCreateModal(false);
      setSelectedPatient(null);
      setPrescriptionItems([
        { medication_id: '', medication_name: '', dosage: '', frequency: '', duration: '', route: 'oral', observations: '' }
      ]);
    }, {
      loading: 'Generando receta...',
      success: 'Receta generada exitosamente',
      error: 'Error al generar receta'
    });
  };

  const resetForm = () => {
    setSelectedPatient(null);
    setPrescriptionItems([
      { medication_id: '', medication_name: '', dosage: '', frequency: '', duration: '', route: 'oral', observations: '' }
    ]);
    setDoctorSignature(null);
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Recetas Medicas</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Crea y descarga recetas medicas con firma digital
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Nueva Receta
        </Button>
      </div>

      {/* Quick Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Buscar paciente para receta rapida..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        {search && filteredPatients.length > 0 && (
          <div className="mt-2 max-h-64 overflow-y-auto border rounded-lg">
            {filteredPatients.slice(0, 5).map(patient => (
              <button
                key={patient.id}
                onClick={() => {
                  setSelectedPatient(patient);
                  setShowCreateModal(true);
                  setSearch('');
                }}
                className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 border-b last:border-b-0"
              >
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">{patient.first_name} {patient.last_name}</p>
                  <p className="text-sm text-slate-500">{patient.phone}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Create Prescription Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white dark:bg-slate-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Nueva Receta Medica</h2>
                <button onClick={() => { setShowCreateModal(false); resetForm(); }} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Patient Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Paciente</label>
                {selectedPatient ? (
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{selectedPatient.first_name} {selectedPatient.last_name}</p>
                        <p className="text-sm text-slate-500">{selectedPatient.phone} | {selectedPatient.blood_type}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedPatient(null)} className="text-red-500 hover:bg-red-100 p-2 rounded-lg">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Buscar paciente..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10"
                    />
                    {search && filteredPatients.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto border rounded-lg bg-white dark:bg-slate-800 shadow-lg">
                        {filteredPatients.slice(0, 5).map(patient => (
                          <button
                            key={patient.id}
                            onClick={() => { setSelectedPatient(patient); setSearch(''); }}
                            className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 border-b last:border-b-0"
                          >
                            <User className="w-5 h-5 text-slate-400" />
                            <span>{patient.first_name} {patient.last_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Prescription Items */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-medium">Medicamentos</label>
                  <Button size="sm" variant="outline" onClick={addPrescriptionItem}>
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar
                  </Button>
                </div>

                <div className="space-y-4">
                  {prescriptionItems.map((item, index) => (
                    <Card key={index} className="p-4">
                      <div className="flex items-start justify-between mb-4">
                        <Badge variant="outline">Medicamento {index + 1}</Badge>
                        {prescriptionItems.length > 1 && (
                          <button onClick={() => removePrescriptionItem(index)} className="text-red-500 hover:bg-red-100 p-1 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Medicamento</label>
                          <select
                            value={item.medication_id}
                            onChange={(e) => handleMedicationSelect(index, e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-700"
                          >
                            <option value="">Seleccionar medicamento...</option>
                            {medications.map(med => (
                              <option key={med.id} value={med.id}>
                                {med.generic_name} {med.brand_names.length > 0 ? `(${med.brand_names[0]})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Dosis</label>
                          <Input
                            value={item.dosage}
                            onChange={(e) => updatePrescriptionItem(index, 'dosage', e.target.value)}
                            placeholder="Ej: 500mg"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Frecuencia</label>
                          <select
                            value={item.frequency}
                            onChange={(e) => updatePrescriptionItem(index, 'frequency', e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-700"
                          >
                            <option value="">Seleccionar...</option>
                            <option value="Cada 8 horas">Cada 8 horas</option>
                            <option value="Cada 12 horas">Cada 12 horas</option>
                            <option value="Cada 24 horas">Cada 24 horas</option>
                            <option value="Cada 6 horas">Cada 6 horas</option>
                            <option value="Cada 4 horas">Cada 4 horas</option>
                            <option value="Solo en la manana">Solo en la manana</option>
                            <option value="Solo en la noche">Solo en la noche</option>
                            <option value="Cada que sea necesario">Cada que sea necesario</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Duracion</label>
                          <Input
                            value={item.duration}
                            onChange={(e) => updatePrescriptionItem(index, 'duration', e.target.value)}
                            placeholder="Ej: 7 dias"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Via de administracion</label>
                          <select
                            value={item.route}
                            onChange={(e) => updatePrescriptionItem(index, 'route', e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-700"
                          >
                            <option value="oral">Oral</option>
                            <option value="topical">Topica</option>
                            <option value="injection">Inyeccion</option>
                            <option value="inhalation">Inhalacion</option>
                            <option value="rectal">Rectal</option>
                            <option value="sublingual">Sublingual</option>
                            <option value="ophthalmic">Oftalmica</option>
                            <option value="otic">Otica</option>
                            <option value="nasal">Nasal</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Observaciones</label>
                          <Input
                            value={item.observations}
                            onChange={(e) => updatePrescriptionItem(index, 'observations', e.target.value)}
                            placeholder="Ej: Tomar con alimentos"
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Signature */}
              <div>
                <label className="block text-sm font-medium mb-2">Firma del Medico</label>
                {doctorSignature ? (
                  <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-700">
                    <img src={doctorSignature} alt="Firma" className="h-20 mx-auto" />
                    <div className="flex justify-center mt-2">
                      <Button size="sm" variant="outline" onClick={() => setDoctorSignature(null)}>
                        Cambiar Firma
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setShowSignaturePad(true)} className="w-full">
                    <FileText className="w-4 h-4 mr-2" />
                    Dibujar Firma Digital
                  </Button>
                )}
              </div>
            </div>

            <div className="p-6 border-t bg-slate-50 dark:bg-slate-800 flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowCreateModal(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button onClick={handleGeneratePrescription}>
                <Download className="w-4 h-4 mr-2" />
                Generar Receta PDF
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Pad Modal */}
      <SignaturePad
        open={showSignaturePad}
        onOpenChange={setShowSignaturePad}
        onSave={handleSaveSignature}
        onClear={() => setDoctorSignature(null)}
      />

      {/* Info Card */}
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
            <Pill className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Recetas Medicas Digitales</h3>
            <p className="text-sm text-slate-500 mt-1">
              Crea recetas medicas profesionales con busqueda de medicamentos del catalogo,
              generacion automatica de PDF y la opcion de agregar tu firma digital para validez legal.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
