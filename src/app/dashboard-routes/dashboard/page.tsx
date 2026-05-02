'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import {
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  ClipboardList,
  ArrowRight,
  Activity,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import type { Appointment, Patient } from '@/lib/types';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

interface DashboardStats {
  totalPatients: number;
  patientsChange: number;
  appointmentsToday: number;
  monthlyRevenue: number;
  newPatients: number;
}

interface AppointmentWithPatientName {
  id: string;
  user_id: string;
  patient_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  type: string;
  status: string;
  notes: string | null;
  duration_minutes: number | null;
  created_at: string;
  updated_at: string;
  patient?: { first_name: string; last_name: string } | null;
}

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    patientsChange: 0,
    appointmentsToday: 0,
    monthlyRevenue: 0,
    newPatients: 0
  });
  const [todayAppointments, setTodayAppointments] = useState<AppointmentWithPatientName[]>([]);
  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [consultationsByType, setConsultationsByType] = useState<{ name: string; value: number }[]>([]);
  const [patientsEvolution, setPatientsEvolution] = useState<{ month: string; count: number }[]>([]);
  const [alerts, setAlerts] = useState<{ type: string; title: string; description: string }[]>([]);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Consultas independientes paralelizadas
      const [
        totalPatientsRes,
        newPatientsRes,
        lastMonthPatientsRes,
        appointmentsTodayRes,
        recentPatientsRes,
        consultationsRes
      ] = await Promise.all([
        supabase
          .from('patients')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('patients')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', firstDayOfMonth),
        supabase
          .from('patients')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', firstDayOfLastMonth)
          .lte('created_at', lastDayOfLastMonth),
        supabase
          .from('appointments')
          .select('*, patient:patients(first_name, last_name)')
          .eq('user_id', user.id)
          .eq('date', today)
          .in('status', ['pending', 'confirmed'])
          .order('start_time'),
        supabase
          .from('patients')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('consultations')
          .select('type')
          .eq('user_id', user.id)
          .gte('consultation_date', thirtyDaysAgo.toISOString())
      ]);

      // Calcular estadísticas
      const totalPatients = totalPatientsRes.count || 0;
      const newPatients = newPatientsRes.count || 0;
      const lastMonthPatients = lastMonthPatientsRes.count || 0;
      const patientsChange = lastMonthPatients > 0
        ? Math.round(((newPatients - lastMonthPatients) / lastMonthPatients) * 100)
        : 0;

      // Procesar tipos de consulta
      const typeCount: Record<string, number> = {};
      consultationsRes.data?.forEach(c => {
        typeCount[c.type] = (typeCount[c.type] || 0) + 1;
      });

      const consultationTypes = [
        { name: 'General', value: typeCount.general || 0 },
        { name: 'Seguimiento', value: typeCount.seguimiento || 0 },
        { name: 'Psicológica', value: typeCount.psicologica || 0 },
        { name: 'Urgencia', value: typeCount.urgencia || 0 }
      ];

      // Evolución de pacientes (últimos 6 meses) - paralelizado
      const evolutionPromises = Array.from({ length: 6 }, (_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - (5 - i));
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString();

        return supabase
          .from('patients')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', monthStart)
          .lte('created_at', monthEnd)
          .then(res => ({
            month: date.toLocaleDateString('es-ES', { month: 'short' }),
            count: res.count || 0
          }));
      });

      const evolution = await Promise.all(evolutionPromises);

      // Generar alertas inteligentes
      const alertList: { type: string; title: string; description: string }[] = [];

      if (!appointmentsTodayRes.data?.length) {
        alertList.push({
          type: 'info',
          title: 'Sin citas hoy',
          description: 'No tienes citas programadas para el día de hoy'
        });
      }

      if (newPatients === 0) {
        alertList.push({
          type: 'warning',
          title: 'Sin nuevos pacientes este mes',
          description: 'Considera estrategias para atraer nuevos pacientes'
        });
      }

      setStats({
        totalPatients,
        patientsChange,
        appointmentsToday: appointmentsTodayRes.data?.length || 0,
        monthlyRevenue: 0,
        newPatients
      });

      setTodayAppointments(appointmentsTodayRes.data || []);
      setRecentPatients(recentPatientsRes.data || []);
      setConsultationsByType(consultationTypes);
      setPatientsEvolution(evolution);
      setAlerts(alertList);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user, fetchDashboardData]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
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

  const getAppointmentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    };
    return colors[status] || colors.pending;
  };

  const getAppointmentStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      confirmed: 'Confirmada',
      in_progress: 'En curso',
      completed: 'Completada',
      cancelled: 'Cancelada'
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'Doctor'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Resumen de tu actividad
          </p>
        </div>
        <Link
          href="/patients/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Nuevo Paciente
        </Link>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border flex items-start gap-3 ${
                alert.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
                  : 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
              }`}
            >
              <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                alert.type === 'warning' ? 'text-amber-600' : 'text-blue-600'
              }`} aria-hidden="true" />
              <div>
                <p className={`text-sm font-medium ${
                  alert.type === 'warning' ? 'text-amber-800 dark:text-amber-400' : 'text-blue-800 dark:text-blue-400'
                }`}>
                  {alert.title}
                </p>
                <p className={`text-xs mt-0.5 ${
                  alert.type === 'warning' ? 'text-amber-700 dark:text-amber-500' : 'text-blue-700 dark:text-blue-500'
                }`}>
                  {alert.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Pacientes</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{stats.totalPatients}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                +{stats.newPatients} este mes
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Citas Hoy</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{stats.appointmentsToday}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {todayAppointments.length > 0 && todayAppointments[0]?.start_time
                  ? `Próxima: ${todayAppointments[0].start_time.substring(0, 5)}`
                  : 'Sin citas pendientes'}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-green-600 dark:text-green-400" aria-hidden="true" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Nuevos (Mes)</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{stats.newPatients}</p>
              <p className={`flex items-center text-sm mt-1 ${stats.patientsChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {stats.patientsChange >= 0 ? <TrendingUp className="w-4 h-4 mr-1" aria-hidden="true" /> : <TrendingDown className="w-4 h-4 mr-1" aria-hidden="true" />}
                {Math.abs(stats.patientsChange)}% vs mes anterior
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" aria-hidden="true" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Plan Actual</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1 capitalize">
                {profile?.role === 'psicologo' ? 'Profesional' : 'Básico'}
              </p>
              <Link href="/billing" className="text-sm text-blue-600 hover:text-blue-700 mt-1 inline-flex items-center gap-1">
                Actualizar <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </Link>
            </div>
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-orange-600 dark:text-orange-400" aria-hidden="true" />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patients Evolution Chart */}
        <Card className="lg:col-span-2 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Evolución de Pacientes
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={patientsEvolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Consultations by Type */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Consultas por Tipo
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={consultationsByType}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {consultationsByType.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Appointments */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Citas de Hoy
            </h3>
            <Link
              href="/appointments"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Ver todas
            </Link>
          </div>

          {todayAppointments.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
              <p>No tienes citas programadas para hoy</p>
              <Link
                href="/appointments"
                className="inline-flex items-center gap-2 mt-3 text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Agendar nueva cita
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {todayAppointments.slice(0, 5).map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-blue-600">
                        {appointment.start_time?.substring(0, 5)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {appointment.patient?.first_name} {appointment.patient?.last_name}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {getConsultationTypeLabel(appointment.type)}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAppointmentStatusColor(appointment.status)}`}>
                    {getAppointmentStatusLabel(appointment.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Patients */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Pacientes Recientes
            </h3>
            <Link
              href="/patients"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Ver todos
            </Link>
          </div>

          {recentPatients.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
              <p>No hay pacientes registrados</p>
              <Link
                href="/patients/new"
                className="inline-flex items-center gap-2 mt-3 text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Agregar paciente
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentPatients.map((patient) => (
                <Link
                  key={patient.id}
                  href={`/patients/${patient.id}`}
                  className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                    {patient.first_name.charAt(0)}{patient.last_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate">
                      {patient.first_name} {patient.last_name}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                      {patient.phone}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Accesos Rápidos
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { href: '/patients/new', icon: Users, label: 'Nuevo Paciente', color: 'blue' },
            { href: '/consultations/new', icon: ClipboardList, label: 'Nueva Consulta', color: 'green' },
            { href: '/appointments/new', icon: Calendar, label: 'Nueva Cita', color: 'purple' },
            { href: '/ai-assistant', icon: Activity, label: 'Asistente IA', color: 'orange' }
          ].map(action => (
            <Link
              key={action.href}
              href={action.href}
              className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <div className={`w-12 h-12 bg-${action.color}-100 dark:bg-${action.color}-900/30 rounded-xl flex items-center justify-center`}>
                <action.icon className={`w-6 h-6 text-${action.color}-600 dark:text-${action.color}-400`} aria-hidden="true" />
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 text-center">{action.label}</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}