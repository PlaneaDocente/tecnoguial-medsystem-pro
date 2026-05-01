// Types for TecnoGuiAl MedSystem Pro

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'doctor' | 'psicologo' | 'admin';
  specialty: string | null;
  phone: string | null;
  avatar_url: string | null;
  signature_url: string | null;
  license_number: string | null;
  years_experience: number;
  bio: string | null;
  schedule: ScheduleDay[];
  created_at: string;
  updated_at: string;
}

export interface ScheduleDay {
  day: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export interface Patient {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  gender: 'male' | 'female' | 'other' | null;
  curp: string | null;
  email: string | null;
  phone: string;
  phone_alt: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  blood_type: string;
  weight: number | null;
  height: number | null;
  photo_url: string | null;
  insurance_company: string | null;
  insurance_policy: string | null;
  insurance_expiry: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  allergies?: PatientAllergy[];
  antecedents?: PatientAntecedent[];
  chronic_diseases?: PatientChronicDisease[];
  files?: PatientFile[];
}

export interface PatientAllergy {
  id: string;
  patient_id: string;
  allergen: string;
  severity: 'mild' | 'moderate' | 'severe';
  reaction_type: string | null;
  notes: string | null;
  created_at: string;
}

export interface PatientAntecedent {
  id: string;
  patient_id: string;
  type: 'family' | 'personal' | 'surgical';
  condition: string;
  relationship: string | null;
  diagnosed_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface PatientChronicDisease {
  id: string;
  patient_id: string;
  disease_id: string | null;
  disease_name: string;
  diagnosis_date: string | null;
  status: 'controlled' | 'uncontrolled';
  notes: string | null;
  created_at: string;
}

export interface PatientFile {
  id: string;
  patient_id: string;
  file_name: string;
  file_type: string | null;
  file_url: string;
  storage_path: string | null;
  file_category: 'laboratory' | 'imaging' | 'clinical' | 'prescription' | 'other';
  file_size: number | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface Consultation {
  id: string;
  patient_id: string;
  user_id: string;
  parent_consultation_id: string | null;
  type: 'general' | 'seguimiento' | 'urgencia' | 'psicologica';
  status: 'draft' | 'completed';
  consultation_date: string;
  chief_complaint: string | null;
  symptoms: string | null;
  physical_exam: PhysicalExam;
  vital_signs: VitalSigns;
  diagnosis_ids: string[];
  diagnosis_names: string[];
  treatment: Treatment;
  notes: string | null;
  ai_summary: string | null;
  evolution_note: string | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
  patient?: Patient;
  prescriptions?: ConsultationPrescription[];
}

export interface PhysicalExam {
  inspection: string;
  palpation: string;
  percussion: string;
  auscultation: string;
}

export interface VitalSigns {
  blood_pressure: string;
  heart_rate: number;
  temperature: number;
  respiratory_rate: number;
  oxygen_saturation: number;
}

export interface Treatment {
  medications: MedicationPrescription[];
  procedures: string[];
  recommendations: string;
}

export interface MedicationPrescription {
  medication_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  quantity: number;
  observations: string;
}

export interface ConsultationPrescription {
  id: string;
  consultation_id: string;
  medication_id: string | null;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string | null;
  route: string | null;
  quantity: number | null;
  observations: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number;
  type: 'general' | 'seguimiento' | 'urgencia' | 'psicologica';
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  notes: string | null;
  reminder_sent: boolean;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  patient?: Patient;
}

export interface Medication {
  id: string;
  generic_name: string;
  brand_names: string[];
  active_ingredient: string | null;
  pharmacological_group: string | null;
  dosage_forms: string[];
  routes: string[];
  indications: string | null;
  contraindications: string | null;
  side_effects: string | null;
  precautions: string | null;
  interactions: string | null;
  storage: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Disease {
  id: string;
  name: string;
  category: string;
  description: string | null;
  typical_symptoms: string[];
  etiology: string | null;
  treatment: string | null;
  complications: string | null;
  prevention: string | null;
  cie10_code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  plan: 'basic' | 'professional' | 'clinics';
  status: 'active' | 'cancelled' | 'past_due' | 'trialing';
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  stripe_invoice_id: string | null;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'void';
  invoice_date: string | null;
  paid_at: string | null;
  invoice_pdf_url: string | null;
  created_at: string;
}

export interface ClinicSettings {
  id: string;
  user_id: string;
  clinic_name: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  tax_id: string | null;
  fiscal_address: string | null;
  notification_prefs: NotificationPrefs;
  theme: 'light' | 'dark' | 'system';
  created_at: string;
  updated_at: string;
}

export interface NotificationPrefs {
  email: boolean;
  reminders: boolean;
  appointment_confirmation: boolean;
}

export interface Conversation {
  id: string;
  patient_id: string;
  user_id: string;
  last_message_at: string;
  created_at: string;
  patient?: Patient;
  messages?: Message[];
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  attachments: string[];
  is_read: boolean;
  sent_at: string;
}

export interface AISuggestionLog {
  id: string;
  user_id: string;
  consultation_id: string | null;
  suggestion_type: 'diagnosis' | 'summary' | 'notes' | 'search';
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  accepted: boolean | null;
  created_at: string;
}

export interface DashboardStats {
  totalPatients: number;
  patientsThisMonth: number;
  patientsChange: number;
  appointmentsToday: number;
  nextAppointment: Appointment | null;
  monthlyRevenue: number;
  revenueChange: number;
  newPatientsThisMonth: number;
  recentActivity: ActivityItem[];
  alerts: Alert[];
  appointmentsByType: Record<string, number>;
  patientsEvolution: { month: string; count: number }[];
}

export interface ActivityItem {
  id: string;
  type: 'patient_added' | 'consultation_completed' | 'appointment_confirmed';
  description: string;
  timestamp: string;
}

export interface Alert {
  id: string;
  type: 'warning' | 'info' | 'urgent';
  title: string;
  description: string;
  actionUrl?: string;
}
