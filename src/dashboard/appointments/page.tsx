'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Calendar,
  Plus,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  X,
  Check
} from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import type { Appointment, Patient } from '@/lib/types';

export default function AppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<(Appointment & { patient?: Patient })[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    if (user) fetchAppointments();
  }, [user, currentDate]);

  const fetchAppointments = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from('appointments')
        .select('*, patient:patients(id, first_name, last_name, phone)')
        .eq('user_id', user.id)
        .gte('date', firstDay.toISOString().split('T')[0])
        .lte('date', lastDay.toISOString().split('T')[0])
        .order('date')
        .order('start_time');

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];

    // Add padding days from previous month
    const startPadding = firstDay.getDay();
    for (let i = startPadding - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push(d);
    }

    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    // Add padding days for next month
    const endPadding = 42 - days.length;
    for (let i = 1; i <= endPadding; i++) {
      days.push(new Date(year, month + 1, i));
    }

    return days;
  };

  const getAppointmentsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return appointments.filter(a => a.date === dateStr);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const changeMonth = (delta: number) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const updateAppointmentStatus = async (appointmentId: string, status: string) => {
    try {
      await supabase
        .from('appointments')
        .update({ status })
        .eq('id', appointmentId);

      setAppointments(prev =>
        prev.map(a => a.id === appointmentId ? { ...a, status: status as Appointment['status'] } : a)
      );
      setShowAppointmentModal(false);
    } catch (error) {
      console.error('Error updating appointment:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    };
    return colors[status] || colors.pending;
  };

  const days = getDaysInMonth(currentDate);
  const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Agenda</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Calendario de citas
          </p>
        </div>
        <Link href="/appointments/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          Nueva Cita
        </Link>
      </div>

      <Card className="p-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => changeMonth(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
              Hoy
            </Button>
            <Button variant="outline" size="icon" onClick={() => changeMonth(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Week Days Header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-sm font-medium text-slate-500 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => {
            const dayAppointments = getAppointmentsForDate(day);
            const hasAppointments = dayAppointments.length > 0;

            return (
              <button
                key={idx}
                onClick={() => {
                  setSelectedDate(day.toISOString().split('T')[0]);
                  setSelectedAppointment(null);
                }}
                className={`
                  min-h-[80px] p-2 border rounded-lg text-left transition-colors
                  ${!isCurrentMonth(day) ? 'bg-slate-50 dark:bg-slate-800/50 text-slate-400' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'}
                  ${isToday(day) ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900' : ''}
                `}
              >
                <span className={`
                  text-sm font-medium
                  ${isToday(day) ? 'text-blue-600' : ''}
                `}>
                  {day.getDate()}
                </span>
                {hasAppointments && (
                  <div className="mt-1 space-y-1">
                    {dayAppointments.slice(0, 2).map(apt => (
                      <div
                        key={apt.id}
                        className={`text-xs px-1 py-0.5 rounded truncate ${getStatusColor(apt.status)}`}
                      >
                        {apt.start_time?.substring(0, 5)}
                      </div>
                    ))}
                    {dayAppointments.length > 2 && (
                      <div className="text-xs text-slate-500">+{dayAppointments.length - 2}</div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Selected Day Appointments */}
      {selectedDate && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Citas del {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-ES', {
              weekday: 'long',
              day: 'numeric',
              month: 'long'
            })}
          </h3>

          {getAppointmentsForDate(new Date(selectedDate + 'T00:00:00')).length === 0 ? (
            <p className="text-center text-slate-500 py-8">No hay citas para este día</p>
          ) : (
            <div className="space-y-3">
              {getAppointmentsForDate(new Date(selectedDate + 'T00:00:00')).map(apt => (
                <div
                  key={apt.id}
                  className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                  onClick={() => {
                    setSelectedAppointment(apt);
                    setShowAppointmentModal(true);
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                      {apt.start_time?.substring(0, 5)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {apt.patient?.first_name} {apt.patient?.last_name}
                      </p>
                      <p className="text-sm text-slate-500">{apt.patient?.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(apt.status)}>
                      {apt.status}
                    </Badge>
                    <Badge variant="outline">
                      {apt.type}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Appointment Modal */}
      <Dialog open={showAppointmentModal} onOpenChange={setShowAppointmentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalles de la Cita</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                  {selectedAppointment.start_time?.substring(0, 5)}
                </div>
                <div>
                  <p className="font-semibold text-lg">
                    {selectedAppointment.patient?.first_name} {selectedAppointment.patient?.last_name}
                  </p>
                  <p className="text-slate-500">{selectedAppointment.patient?.phone}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Fecha</p>
                  <p className="font-medium">
                    {new Date(selectedAppointment.date + 'T00:00:00').toLocaleDateString('es-ES')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Tipo</p>
                  <p className="font-medium">{selectedAppointment.type}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Duración</p>
                  <p className="font-medium">{selectedAppointment.duration_minutes} minutos</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Estado</p>
                  <Badge className={getStatusColor(selectedAppointment.status)}>
                    {selectedAppointment.status}
                  </Badge>
                </div>
              </div>

              {selectedAppointment.notes && (
                <div>
                  <p className="text-sm text-slate-500">Notas</p>
                  <p className="font-medium">{selectedAppointment.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            {selectedAppointment?.status === 'pending' && (
              <Button onClick={() => updateAppointmentStatus(selectedAppointment!.id, 'confirmed')}>
                <Check className="w-4 h-4 mr-2" />
                Confirmar
              </Button>
            )}
            {(selectedAppointment?.status === 'pending' || selectedAppointment?.status === 'confirmed') && (
              <Button variant="destructive" onClick={() => updateAppointmentStatus(selectedAppointment!.id, 'cancelled')}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            )}
            {selectedAppointment?.status === 'confirmed' && (
              <Button onClick={() => updateAppointmentStatus(selectedAppointment!.id, 'completed')}>
                <Check className="w-4 h-4 mr-2" />
                Completar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
