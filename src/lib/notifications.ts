'use client';

import { supabase } from '@/integrations/supabase/client';
import type { Patient, Appointment, Profile } from '@/lib/types';

export interface EmailNotification {
  to: string;
  subject: string;
  body: string;
  type: 'appointment_reminder' | 'appointment_confirmed' | 'appointment_cancelled' | 'welcome' | 'password_reset';
}

export async function sendEmailNotification(notification: EmailNotification): Promise<boolean> {
  try {
    // In production, this would call a serverless function or API endpoint
    // that uses a service like SendGrid, Resend, or AWS SES
    // For now, we log the notification and save it to the database

    const { error } = await supabase
      .from('notification_log')
      .insert({
        recipient_email: notification.to,
        subject: notification.subject,
        body: notification.body,
        notification_type: notification.type,
        sent_at: new Date().toISOString(),
        status: 'sent'
      });

    if (error) {
      console.error('Error logging notification:', error);
    }

    console.log('Email notification:', notification);
    return true;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
}

export function formatAppointmentReminder(
  patient: Patient,
  appointment: Appointment,
  doctorName: string,
  clinicName?: string
): EmailNotification {
  const appointmentDate = new Date(`${appointment.date}T${appointment.start_time}`);
  const formattedDate = appointmentDate.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = appointmentDate.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    to: patient.email || '',
    subject: `Recordatorio de Cita - ${formattedDate}`,
    body: `
Estimado/a ${patient.first_name} ${patient.last_name},

Le recordamos que tiene una cita programada:

📅 Fecha: ${formattedDate}
🕐 Hora: ${formattedTime}
👨‍⚕️ Doctor: Dr. ${doctorName}
${clinicName ? `🏥 Clínica: ${clinicName}` : ''}

Si necesita reprogramar o cancelar, por favor contáctenos con anticipación.

Saludos cordiales,
${doctorName}
    `.trim(),
    type: 'appointment_reminder'
  };
}

export function formatAppointmentConfirmed(
  patient: Patient,
  appointment: Appointment,
  doctorName: string,
  clinicName?: string
): EmailNotification {
  const appointmentDate = new Date(`${appointment.date}T${appointment.start_time}`);
  const formattedDate = appointmentDate.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = appointmentDate.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    to: patient.email || '',
    subject: 'Cita Confirmada - TecnoGuiAl MedSystem',
    body: `
Estimado/a ${patient.first_name} ${patient.last_name},

Su cita ha sido confirmada:

📅 Fecha: ${formattedDate}
🕐 Hora: ${formattedTime}
👨‍⚕️ Doctor: Dr. ${doctorName}
${clinicName ? `🏥 Clínica: ${clinicName}` : ''}

Por favor arrive 10 minutos antes de su cita.

Saludos cordiales,
${doctorName}
    `.trim(),
    type: 'appointment_confirmed'
  };
}

export function formatAppointmentCancelled(
  patient: Patient,
  appointment: Appointment,
  doctorName: string,
  reason?: string
): EmailNotification {
  const appointmentDate = new Date(`${appointment.date}T${appointment.start_time}`);
  const formattedDate = appointmentDate.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = appointmentDate.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    to: patient.email || '',
    subject: 'Cita Cancelada - TecnoGuiAl MedSystem',
    body: `
Estimado/a ${patient.first_name} ${patient.last_name},

Le informamos que su cita ha sido cancelada:

📅 Fecha: ${formattedDate}
🕐 Hora: ${formattedTime}
👨‍⚕️ Doctor: Dr. ${doctorName}
${reason ? `\n📝 Motivo: ${reason}` : ''}

Si desea reprogramar, por favor contáctenos.

Saludos cordiales,
${doctorName}
    `.trim(),
    type: 'appointment_cancelled'
  };
}

export async function sendAppointmentReminder(appointmentId: string): Promise<boolean> {
  try {
    // Fetch appointment with patient and doctor info
    const { data: appointment } = await supabase
      .from('appointments')
      .select('*, patient:patients(*)')
      .eq('id', appointmentId)
      .single();

    if (!appointment || !appointment.patient) {
      return false;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', appointment.user_id)
      .single();

    const { data: settings } = await supabase
      .from('clinic_settings')
      .select('clinic_name')
      .eq('user_id', appointment.user_id)
      .maybeSingle();

    const notification = formatAppointmentReminder(
      appointment.patient as Patient,
      appointment as Appointment,
      profile?.full_name || 'Doctor',
      settings?.clinic_name || undefined
    );

    return await sendEmailNotification(notification);
  } catch (error) {
    console.error('Error sending appointment reminder:', error);
    return false;
  }
}

export async function sendAppointmentConfirmation(appointmentId: string): Promise<boolean> {
  try {
    const { data: appointment } = await supabase
      .from('appointments')
      .select('*, patient:patients(*)')
      .eq('id', appointmentId)
      .single();

    if (!appointment || !appointment.patient) {
      return false;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', appointment.user_id)
      .single();

    const { data: settings } = await supabase
      .from('clinic_settings')
      .select('clinic_name')
      .eq('user_id', appointment.user_id)
      .maybeSingle();

    const notification = formatAppointmentConfirmed(
      appointment.patient as Patient,
      appointment as Appointment,
      profile?.full_name || 'Doctor',
      settings?.clinic_name || undefined
    );

    return await sendEmailNotification(notification);
  } catch (error) {
    console.error('Error sending confirmation:', error);
    return false;
  }
}

export async function getNotificationHistory(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from('notification_log')
    .select('*')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  return data || [];
}
