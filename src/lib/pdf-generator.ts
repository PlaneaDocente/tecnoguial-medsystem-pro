import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export interface PatientData {
  first_name: string;
  last_name: string;
  birth_date?: string;
  gender?: string;
  phone: string;
  email?: string;
  address?: string;
  blood_type: string;
  weight?: number;
  height?: number;
}

export interface ConsultationData {
  consultation_date: string;
  type: string;
  chief_complaint?: string;
  symptoms?: string;
  diagnosis_names: string[];
  treatment: any;
  notes?: string;
  prescriptions?: any[];
}

export interface PrescriptionItem {
  medication_name: string;
  dosage: string;
  frequency: string;
  duration?: string;
  route?: string;
  observations?: string;
}

export function generatePatientReport(
  patient: PatientData,
  allergies: any[],
  antecedents: any[],
  chronicDiseases: any[],
  consultations: ConsultationData[],
  doctorName: string,
  clinicName?: string
): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(20);
  doc.setTextColor(0, 102, 204);
  doc.text('Expediente Clínico', pageWidth / 2, 20, { align: 'center' });

  if (clinicName) {
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(clinicName, pageWidth / 2, 28, { align: 'center' });
  }

  // Patient Info Box
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('Datos del Paciente', 15, 45);

  doc.setFontSize(10);
  doc.setTextColor(60);
  const patientInfo = [
    `Nombre: ${patient.first_name} ${patient.last_name}`,
    `Fecha de Nacimiento: ${patient.birth_date || 'N/A'}`,
    `Género: ${patient.gender || 'N/A'}`,
    `Teléfono: ${patient.phone}`,
    `Email: ${patient.email || 'N/A'}`,
    `Tipo de Sangre: ${patient.blood_type}`,
    `Peso: ${patient.weight ? `${patient.weight} kg` : 'N/A'}`,
    `Altura: ${patient.height ? `${patient.height} cm` : 'N/A'}`,
  ];

  patientInfo.forEach((info, index) => {
    doc.text(info, 15, 55 + index * 6);
  });

  // Allergies
  if (allergies.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(220, 53, 69);
    doc.text('Alergias', 15, 110);

    doc.setFontSize(10);
    doc.setTextColor(60);
    allergies.forEach((allergy, index) => {
      doc.text(
        `• ${allergy.allergen} (${allergy.severity}) - ${allergy.reaction_type || 'Sin descripción'}`,
        15,
        118 + index * 6
      );
    });
  }

  // Antecedents
  let yPos = 110 + allergies.length * 6 + 15;
  if (antecedents.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Antecedentes', 15, yPos);

    doc.setFontSize(10);
    doc.setTextColor(60);
    antecedents.forEach((ant, index) => {
      doc.text(
        `• ${ant.type}: ${ant.condition}${ant.relationship ? ` (${ant.relationship})` : ''}`,
        15,
        yPos + 8 + index * 6
      );
    });
    yPos += antecedents.length * 6 + 15;
  }

  // Chronic Diseases
  if (chronicDiseases.length > 0) {
    doc.setFontSize(14);
    doc.text('Enfermedades Crónicas', 15, yPos);

    doc.setFontSize(10);
    chronicDiseases.forEach((disease, index) => {
      doc.text(
        `• ${disease.disease_name} - ${disease.status}`,
        15,
        yPos + 8 + index * 6
      );
    });
    yPos += chronicDiseases.length * 6 + 15;
  }

  // Consultations History
  yPos += 10;
  doc.setFontSize(14);
  doc.text('Historial de Consultas', 15, yPos);

  consultations.forEach((consultation, index) => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    yPos += 10;
    doc.setFontSize(11);
    doc.setTextColor(0, 102, 204);
    doc.text(
      `Consulta ${consultation.type} - ${new Date(consultation.consultation_date).toLocaleDateString('es-ES')}`,
      15,
      yPos
    );

    yPos += 6;
    doc.setFontSize(9);
    doc.setTextColor(60);

    if (consultation.chief_complaint) {
      doc.text(`Motivo: ${consultation.chief_complaint}`, 20, yPos);
      yPos += 5;
    }

    if (consultation.diagnosis_names.length > 0) {
      doc.text(`Diagnóstico: ${consultation.diagnosis_names.join(', ')}`, 20, yPos);
      yPos += 5;
    }

    if (consultation.prescriptions && consultation.prescriptions.length > 0) {
      doc.text('Tratamiento:', 20, yPos);
      yPos += 5;
      consultation.prescriptions.forEach((rx: any) => {
        doc.text(
          `  • ${rx.medication_name} ${rx.dosage} ${rx.frequency} ${rx.duration || ''}`,
          25,
          yPos
        );
        yPos += 5;
      });
    }

    yPos += 5;
  });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Generado por ${doctorName} - ${new Date().toLocaleDateString('es-ES')} - Página ${i} de ${totalPages}`,
      pageWidth / 2,
      285,
      { align: 'center' }
    );
  }

  return doc;
}

export function generatePrescription(
  patient: PatientData,
  prescriptions: PrescriptionItem[],
  doctorName: string,
  doctorLicense?: string,
  clinicName?: string,
  doctorSignature?: string
): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(22);
  doc.setTextColor(0, 102, 204);
  doc.text('RECETA MÉDICA', pageWidth / 2, 25, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(clinicName || 'TecnoGuiAl MedSystem Pro', pageWidth / 2, 33, { align: 'center' });

  // Date
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })}`, pageWidth - 15, 25, { align: 'right' });

  // Patient Info
  doc.setDrawColor(200);
  doc.line(15, 42, pageWidth - 15, 42);

  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('PACIENTE', 15, 52);

  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(`${patient.first_name} ${patient.last_name}`, 15, 60);
  doc.text(`Tel: ${patient.phone}`, 15, 67);
  if (patient.birth_date) {
    doc.text(`Edad: ${calculateAge(patient.birth_date)} años`, 100, 60);
  }

  // Prescription Items
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('PRESCRIPCIÓN', 15, 82);

  prescriptions.forEach((rx, index) => {
    const yPos = 92 + index * 25;

    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`${index + 1}. ${rx.medication_name}`, 20, yPos);

    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text(`Dosis: ${rx.dosage}`, 25, yPos + 6);
    doc.text(`Frecuencia: ${rx.frequency}`, 25, yPos + 12);
    if (rx.duration) doc.text(`Duración: ${rx.duration}`, 120, yPos + 6);
    if (rx.route) doc.text(`Vía: ${rx.route}`, 120, yPos + 12);
    if (rx.observations) doc.text(`Obs: ${rx.observations}`, 25, yPos + 18);
  });

  // Doctor Signature Area
  const signatureY = 200;
  doc.line(15, signatureY, pageWidth - 15, signatureY);

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('MÉDICO', 15, signatureY + 10);
  doc.text(doctorName, 15, signatureY + 20);
  if (doctorLicense) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Cédula Profesional: ${doctorLicense}`, 15, signatureY + 27);
  }

  // Signature Image if available
  if (doctorSignature) {
    try {
      doc.addImage(doctorSignature, 'PNG', 100, signatureY + 5, 60, 30);
    } catch (e) {
      // Signature image couldn't be added
    }
  } else {
    doc.line(100, signatureY + 40, 160, signatureY + 40);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Firma', 130, signatureY + 45);
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    'Este documento es una prescripción médica. Conserve para futuras referencias.',
    pageWidth / 2,
    280,
    { align: 'center' }
  );

  return doc;
}

export function generateConsultationNote(
  patient: PatientData,
  consultation: ConsultationData,
  doctorName: string,
  doctorLicense?: string,
  clinicName?: string
): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(18);
  doc.setTextColor(0, 102, 204);
  doc.text('NOTA MÉDICA', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(clinicName || 'TecnoGuiAl MedSystem Pro', pageWidth / 2, 28, { align: 'center' });

  // Date and Type
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(
    `Fecha: ${new Date(consultation.consultation_date).toLocaleDateString('es-ES')}`,
    15,
    40
  );
  doc.text(`Tipo: ${getConsultationTypeLabel(consultation.type)}`, pageWidth - 15, 40, { align: 'right' });

  // Patient
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('PACIENTE', 15, 52);

  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(`${patient.first_name} ${patient.last_name}`, 15, 60);
  if (patient.birth_date) {
    doc.text(`Edad: ${calculateAge(patient.birth_date)} años`, 15, 67);
  }

  // SOAP Format
  let yPos = 80;

  if (consultation.chief_complaint) {
    doc.setFontSize(11);
    doc.setTextColor(0, 102, 204);
    doc.text('SUBJETIVO (Motivo de consulta)', 15, yPos);
    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text(consultation.chief_complaint, 20, yPos + 7);
    yPos += 15;
  }

  if (consultation.symptoms) {
    doc.setFontSize(11);
    doc.setTextColor(0, 102, 204);
    doc.text('SÍNTOMAS', 15, yPos);
    doc.setFontSize(10);
    doc.setTextColor(60);
    const lines = doc.splitTextToSize(consultation.symptoms, pageWidth - 40);
    doc.text(lines, 20, yPos + 7);
    yPos += 7 + lines.length * 5 + 5;
  }

  // Objective - Vital Signs
  if (consultation.treatment?.vital_signs) {
    doc.setFontSize(11);
    doc.setTextColor(0, 102, 204);
    doc.text('OBJETIVO (Signos Vitales)', 15, yPos);
    yPos += 7;

    doc.setFontSize(10);
    doc.setTextColor(60);
    const vs = consultation.treatment.vital_signs;
    const vsText = [
      vs.blood_pressure ? `PA: ${vs.blood_pressure} mmHg` : '',
      vs.heart_rate ? `FC: ${vs.heart_rate} lpm` : '',
      vs.temperature ? `T°: ${vs.temperature} °C` : '',
      vs.respiratory_rate ? `FR: ${vs.respiratory_rate} rpm` : '',
      vs.oxygen_saturation ? `SatO2: ${vs.oxygen_saturation}%` : '',
    ].filter(Boolean).join('  |  ');

    doc.text(vsText, 20, yPos);
    yPos += 15;
  }

  // Assessment - Diagnosis
  if (consultation.diagnosis_names.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(0, 102, 204);
    doc.text('EVALUACIÓN (Diagnóstico)', 15, yPos);
    doc.setFontSize(10);
    doc.setTextColor(60);
    consultation.diagnosis_names.forEach((dx, index) => {
      doc.text(`${index + 1}. ${dx}`, 20, yPos + 7 + index * 6);
    });
    yPos += 7 + consultation.diagnosis_names.length * 6 + 5;
  }

  // Plan - Treatment
  if (consultation.prescriptions && consultation.prescriptions.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(0, 102, 204);
    doc.text('PLAN (Tratamiento)', 15, yPos);
    yPos += 7;

    doc.setFontSize(10);
    doc.setTextColor(60);
    consultation.prescriptions.forEach((rx: any, index: number) => {
      doc.text(
        `${index + 1}. ${rx.medication_name} - ${rx.dosage} - ${rx.frequency} ${rx.duration ? `por ${rx.duration}` : ''}`,
        20,
        yPos + index * 6
      );
    });
    yPos += consultation.prescriptions.length * 6 + 10;
  }

  if (consultation.notes) {
    doc.setFontSize(11);
    doc.setTextColor(0, 102, 204);
    doc.text('NOTAS ADICIONALES', 15, yPos);
    doc.setFontSize(10);
    doc.setTextColor(60);
    const lines = doc.splitTextToSize(consultation.notes, pageWidth - 40);
    doc.text(lines, 20, yPos + 7);
  }

  // Doctor Signature
  doc.line(15, 250, pageWidth - 15, 250);

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('Dr(a). ' + doctorName, 15, 260);
  if (doctorLicense) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Cédula: ${doctorLicense}`, 15, 267);
  }

  return doc;
}

function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function getConsultationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    general: 'Consulta General',
    seguimiento: 'Seguimiento',
    urgencia: 'Urgencia',
    psicologica: 'Consulta Psicológica'
  };
  return labels[type] || type;
}

export function downloadPDF(doc: jsPDF, filename: string) {
  doc.save(filename);
}
