'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  FileText,
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  Stethoscope,
  Clock,
  Upload,
  X,
  Save,
  AlertCircle,
  Download,
  File,
  Trash,
  Image as ImageIcon
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { generatePatientReport, downloadPDF } from '@/lib/pdf-generator';
import { uploadPatientFile, deletePatientFile, formatFileSize } from '@/lib/file-upload';
import type { Patient, PatientAllergy, PatientAntecedent, PatientChronicDisease, PatientFile, Consultation } from '@/lib/types';

export default function PatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const patientId = params.id as string;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [allergies, setAllergies] = useState<PatientAllergy[]>([]);
  const [antecedents, setAntecedents] = useState<PatientAntecedent[]>([]);
  const [chronicDiseases, setChronicDiseases] = useState<PatientChronicDisease[]>([]);
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllergyModal, setShowAllergyModal] = useState(false);
  const [showAntecedentModal, setShowAntecedentModal] = useState(false);
  const [showChronicModal, setShowChronicModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('laboratory');
  const [uploadNotes, setUploadNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (patientId) {
      fetchPatientData();
    }
  }, [patientId]);

  const fetchPatientData = async () => {
    try {
      const { data: patientData } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .maybeSingle();

      if (patientData) {
        setPatient(patientData);

        const [allergiesData, antecedentsData, diseasesData, filesData, consultationsData] = await Promise.all([
          supabase.from('patient_allergies').select('*').eq('patient_id', patientId).order('created_at'),
          supabase.from('patient_antecedents').select('*').eq('patient_id', patientId).order('created_at'),
          supabase.from('patient_chronic_diseases').select('*').eq('patient_id', patientId).order('created_at'),
          supabase.from('patient_files').select('*').eq('patient_id', patientId).order('created_at'),
          supabase.from('consultations').select('*').eq('patient_id', patientId).order('consultation_date', { ascending: false }).limit(10)
        ]);

        setAllergies(allergiesData.data || []);
        setAntecedents(antecedentsData.data || []);
        setChronicDiseases(diseasesData.data || []);
        setFiles(filesData.data || []);
        setConsultations(consultationsData.data || []);
      }
    } catch (error) {
      console.error('Error fetching patient data:', error);
      toast.error('Error al cargar datos del paciente');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!patient || !user) return;

    toast.promise(async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const { data: settings } = await supabase
        .from('clinic_settings')
        .select('clinic_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const doc = generatePatientReport(
        patient,
        allergies,
        antecedents,
        chronicDiseases,
        consultations.map(c => ({ ...c, treatment: {} })),
        profile?.full_name || 'Doctor',
        settings?.clinic_name
      );

      downloadPDF(doc, `expediente_${patient.last_name}_${patient.first_name}.pdf`);
    }, {
      loading: 'Generando PDF...',
      success: 'PDF descargado exitosamente',
      error: 'Error al generar PDF'
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('El archivo debe ser menor a 10MB');
        return;
      }
      setSelectedFile(file);
      setShowUploadModal(true);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;
    setUploading(true);

    try {
      const result = await uploadPatientFile(
        patientId,
        selectedFile,
        uploadCategory,
        user.id,
        uploadNotes
      );

      if (result.success && result.fileUrl) {
        toast.success('Archivo subido exitosamente');
        setShowUploadModal(false);
        setSelectedFile(null);
        setUploadNotes('');
        fetchPatientData();
      } else {
        toast.error(result.error || 'Error al subir archivo');
      }
    } catch (error) {
      toast.error('Error al subir archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (file: PatientFile) => {
    if (!confirm('¿Eliminar este archivo?')) return;

    const success = await deletePatientFile(file.id, file.storage_path);
    if (success) {
      toast.success('Archivo eliminado');
      fetchPatientData();
    } else {
      toast.error('Error al eliminar archivo');
    }
  };

  const getAge = (birthDate: string | null) => {
    if (!birthDate) return 'N/A';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return `${age} años`;
  };

  const getGenderLabel = (gender: string | null) => {
    const labels: Record<string, string> = { male: 'Masculino', female: 'Femenino', other: 'Otro' };
    return labels[gender || ''] || 'N/A';
  };

  const getSeverityBadge = (severity: string) => {
    const styles: Record<string, string> = {
      mild: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      moderate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      severe: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    };
    return styles[severity] || styles.moderate;
  };

  const getConsultationTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      general: 'Consulta General',
      seguimiento: 'Seguimiento',
      urgencia: 'Urgencia',
      psicologica: 'Psicológica'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 mx-auto text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Paciente no encontrado</h2>
        <Link href="/patients" className="text-blue-600 hover:text-blue-700 mt-4 inline-block">
          Volver a pacientes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/patients" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
              {patient.first_name.charAt(0)}{patient.last_name.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {patient.first_name} {patient.last_name}
              </h1>
              <p className="text-slate-500 dark:text-slate-400">
                {getAge(patient.birth_date)} · {getGenderLabel(patient.gender)} · {patient.blood_type}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPDF} className="gap-2">
            <Download className="w-4 h-4" />
            Exportar PDF
          </Button>
          <Link href={`/consultations/new?patientId=${patient.id}`}>
            <Button variant="outline" className="gap-2">
              <FileText className="w-4 h-4" />
              Nueva Consulta
            </Button>
          </Link>
          <Link href={`/appointments/new?patientId=${patient.id}`}>
            <Button variant="outline" className="gap-2">
              <Calendar className="w-4 h-4" />
              Agendar Cita
            </Button>
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {allergies.filter(a => a.severity === 'severe').length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-800 dark:text-red-400">Alergias Importantes</p>
            <p className="text-sm text-red-700 dark:text-red-300">
              {allergies.filter(a => a.severity === 'severe').map(a => a.allergen).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Información Personal</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-slate-400" />
                <span>{patient.phone}</span>
              </div>
              {patient.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span>{patient.email}</span>
                </div>
              )}
              {patient.address && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{patient.address}, {patient.city}</span>
                </div>
              )}
              {patient.curp && (
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span>CURP: {patient.curp}</span>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Contacto de Emergencia</h3>
            {patient.emergency_contact ? (
              <div className="space-y-3">
                <p className="font-medium">{patient.emergency_contact}</p>
                <p className="text-sm text-slate-500">{patient.emergency_phone}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No registrado</p>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Datos Médicos</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Peso</span>
                <span>{patient.weight ? `${patient.weight} kg` : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Altura</span>
                <span>{patient.height ? `${patient.height} cm` : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tipo Sangre</span>
                <Badge>{patient.blood_type}</Badge>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs Content */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="summary">Resumen</TabsTrigger>
              <TabsTrigger value="allergies">Alergias</TabsTrigger>
              <TabsTrigger value="antecedents">Antecedentes</TabsTrigger>
              <TabsTrigger value="diseases">Enfermedades Crónicas</TabsTrigger>
              <TabsTrigger value="files">Archivos</TabsTrigger>
              <TabsTrigger value="history">Historial</TabsTrigger>
            </TabsList>

            {/* Summary Tab */}
            <TabsContent value="summary" className="mt-6 space-y-6">
              <Card className="p-6">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Resumen del Paciente</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{consultations.length}</p>
                    <p className="text-sm text-slate-500">Consultas</p>
                  </div>
                  <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{allergies.length}</p>
                    <p className="text-sm text-slate-500">Alergias</p>
                  </div>
                  <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">{chronicDiseases.length}</p>
                    <p className="text-sm text-slate-500">Enf. Crónicas</p>
                  </div>
                  <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{files.length}</p>
                    <p className="text-sm text-slate-500">Archivos</p>
                  </div>
                </div>
              </Card>

              {allergies.length > 0 && (
                <Card className="p-6">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    Alergias Principales
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {allergies.map(allergy => (
                      <Badge key={allergy.id} className={getSeverityBadge(allergy.severity)}>
                        {allergy.allergen}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}

              {chronicDiseases.length > 0 && (
                <Card className="p-6">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-blue-500" />
                    Enfermedades Crónicas
                  </h3>
                  <div className="space-y-2">
                    {chronicDiseases.map(disease => (
                      <div key={disease.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <span>{disease.disease_name}</span>
                        <Badge variant={disease.status === 'controlled' ? 'default' : 'destructive'}>
                          {disease.status === 'controlled' ? 'Controlada' : 'No controlada'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </TabsContent>

            {/* Allergies Tab */}
            <TabsContent value="allergies" className="mt-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Alergias</h3>
                  <Button size="sm" onClick={() => setShowAllergyModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar
                  </Button>
                </div>
                {allergies.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No hay alergias registradas</p>
                ) : (
                  <div className="space-y-3">
                    {allergies.map(allergy => (
                      <div key={allergy.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div>
                          <p className="font-medium">{allergy.allergen}</p>
                          <p className="text-sm text-slate-500">{allergy.reaction_type || 'Sin descripción'}</p>
                        </div>
                        <Badge className={getSeverityBadge(allergy.severity)}>
                          {allergy.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Antecedents Tab */}
            <TabsContent value="antecedents" className="mt-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Antecedentes</h3>
                  <Button size="sm" onClick={() => setShowAntecedentModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar
                  </Button>
                </div>
                {antecedents.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No hay antecedentes registrados</p>
                ) : (
                  <div className="space-y-4">
                    {['family', 'personal', 'surgical'].map(type => {
                      const items = antecedents.filter(a => a.type === type);
                      if (items.length === 0) return null;
                      return (
                        <div key={type}>
                          <h4 className="text-sm font-medium text-slate-500 mb-2 uppercase">
                            {type === 'family' ? 'Familiares' : type === 'personal' ? 'Personales' : 'Quirúrgicos'}
                          </h4>
                          <div className="space-y-2">
                            {items.map(antecedent => (
                              <div key={antecedent.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <p className="font-medium">{antecedent.condition}</p>
                                {antecedent.relationship && (
                                  <p className="text-sm text-slate-500">{antecedent.relationship}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Chronic Diseases Tab */}
            <TabsContent value="diseases" className="mt-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Enfermedades Crónicas</h3>
                  <Button size="sm" onClick={() => setShowChronicModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar
                  </Button>
                </div>
                {chronicDiseases.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No hay enfermedades crónicas registradas</p>
                ) : (
                  <div className="space-y-3">
                    {chronicDiseases.map(disease => (
                      <div key={disease.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div>
                          <p className="font-medium">{disease.disease_name}</p>
                          <p className="text-sm text-slate-500">
                            Diagnosticado: {disease.diagnosis_date || 'N/A'}
                          </p>
                        </div>
                        <Badge variant={disease.status === 'controlled' ? 'default' : 'destructive'}>
                          {disease.status === 'controlled' ? 'Controlada' : 'No controlada'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Files Tab */}
            <TabsContent value="files" className="mt-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Archivos</h3>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  />
                  <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    Subir Archivo
                  </Button>
                </div>
                {files.length === 0 ? (
                  <div className="text-center py-8">
                    <File className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500">No hay archivos subidos</p>
                    <p className="text-xs text-slate-400 mt-1">PDF, imágenes o documentos hasta 10MB</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {files.map(file => (
                      <div key={file.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg relative group">
                        {file.file_url.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                          <ImageIcon className="w-8 h-8 text-blue-500 mb-2" />
                        ) : (
                          <FileText className="w-8 h-8 text-blue-500 mb-2" />
                        )}
                        <p className="text-sm font-medium truncate pr-6">{file.file_name}</p>
                        <p className="text-xs text-slate-500">{file.file_category}</p>
                        <p className="text-xs text-slate-400">{formatFileSize(file.file_size)}</p>
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a
                            href={file.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 bg-blue-100 dark:bg-blue-900/50 rounded hover:bg-blue-200"
                          >
                            <Download className="w-3 h-3 text-blue-600" />
                          </a>
                          <button
                            onClick={() => handleDeleteFile(file)}
                            className="p-1 bg-red-100 dark:bg-red-900/50 rounded hover:bg-red-200"
                          >
                            <Trash className="w-3 h-3 text-red-600" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="mt-6">
              <Card className="p-6">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Historial de Consultas</h3>
                {consultations.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No hay consultas registradas</p>
                ) : (
                  <div className="space-y-4">
                    {consultations.map(consultation => (
                      <Link
                        key={consultation.id}
                        href={`/consultations/${consultation.id}`}
                        className="block p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge>{getConsultationTypeLabel(consultation.type)}</Badge>
                            <span className="text-sm text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(consultation.consultation_date).toLocaleDateString('es-ES')}
                            </span>
                          </div>
                          <Badge variant={consultation.status === 'completed' ? 'default' : 'secondary'}>
                            {consultation.status === 'completed' ? 'Completada' : 'Borrador'}
                          </Badge>
                        </div>
                        {consultation.chief_complaint && (
                          <p className="text-sm text-slate-600 dark:text-slate-300">
                            {consultation.chief_complaint}
                          </p>
                        )}
                        {consultation.diagnosis_names && consultation.diagnosis_names.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {consultation.diagnosis_names.slice(0, 3).map((name, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Subir Archivo</h3>
              <button onClick={() => setShowUploadModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedFile && (
              <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-slate-500">{formatFileSize(selectedFile.size)}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Categoría</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-700"
                >
                  <option value="laboratory">Laboratorio</option>
                  <option value="imaging">Imagenología</option>
                  <option value="clinical">Estudio Clínico</option>
                  <option value="prescription">Receta</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notas (opcional)</label>
                <Input
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="Agregar notas..."
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowUploadModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? 'Subiendo...' : 'Subir'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
