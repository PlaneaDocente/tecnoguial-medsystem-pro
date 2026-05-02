'use client';

import { useEffect, useState } from 'react';
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
  AlertTriangle,
  Info
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

// ==========================================
// INTERFACES LOCALES (no dependen de @/lib/types)
// ==========================================
interface Patient {
  id: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  created_at?: string;
  user_id?: string;
}

interface Appointment {
  id: string;
  date?: string;
  start_time?: string;
  status?: string;
  type?: string;
  user_id?: string;
  patient?: {
    first_name?: string;
    last_name?: string;
  };
}

interface DashboardAlert {
  type: 'info' | 'warning' | 'error';
  title: string;
  description: string;
}

interface StatsData {
  totalPatients: number;
  patientsChange: number;
  appointmentsToday: number;
  monthlyRevenue: number;
  newPatients: number;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsData>({
    totalPatients: 0,
    patientsChange: 0,
    appointmentsToday: 0,
    monthlyRevenue: 0,
    newPatients: 0
  });
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [consultationsByType, setConsultationsByType] = useState<{ name: string; value: number }[]>([]);
  const [patientsEvolution, setPatientsEvolution] = useState<{ month: string; count: number }[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      setError(null);
      const today = new Date().toISOString().split('T')[0];
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const firstDayLastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0];
      const lastDayLastMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split('T')[0];

      // Fetch total patients
      const { count: totalPatients, error: errTotal } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (errTotal) console.warn('Error total patients:', errTotal.message);

      // Fetch patients this month
      const { count: newPatients, error: errNew } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', firstDayOfMonth);

      if (errNew) console.warn('Error new patients:', errNew.message);

      // Fetch patients last month
      const { count: lastMonthPatients, error: errLast } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', firstDayLastMonth)
        .lte('created_at', lastDayLastMonth);

      if (errLast) console.warn('Error last month:', errLast.message);

      // Calculate change
      const current = newPatients || 0;
      const previous = lastMonthPatients || 0;
      let change = 0;
      if (previous > 0) change = Math.round(((current - previous) / previous) * 100);
      else if (current > 0) change = 100;

      // Appointments today
      const { data: appointmentsToday, error: errApp } = await supabase
        .from('appointments')
        .select('*, patient:patients(first_name, last_name)')
        .eq('user_id', user.id)
        .eq('date', today)
        .in('status', ['pending', 'confirmed'])
        .order('start_time', { ascending: true });

      if (errApp) console.warn('Error appointments:', errApp.message);

      // Recent patients
      const { data: recent, error: errRecent } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (errRecent) console.warn('Error recent:', errRecent.message);

      // ==========================================
      // FIX CRÍTICO: Consultations como any[] para evitar 'never'
      // ==========================================
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: consultationsRaw, error: errConsult } = await (supabase as any)
        .from('consultations')
        .select('type')
        .eq('user_id', user.id)
        .gte('consultation_date', thirtyDaysAgo.toISOString());

      if (errConsult) console.warn('Error consultations:', errConsult.message);

      // Tratar explícitamente como array de objetos any
      const consultationsArray: any[] = consultationsRaw || [];
      const typeCount: Record<string, number> = {};
      
      consultationsArray.forEach((c: any) => {
        if (c && typeof c.type === 'string') {
          typeCount[c.type] = (typeCount[c.type] || 0) + 1;
        }
      });

      const consultationTypes = [
        { name: 'General', value: typeCount.general || 0 },
        { name: 'Seguimiento', value: typeCount.seguimiento || 0 },
        { name: 'Psicológica', value: typeCount.psicologica || 0 },
        { name: 'Urgencia', value: typeCount.urgencia || 0 }
      ];

      // Evolution last 6 months
      const evolution: { month: string; count: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString();

        const { count, error: errEvo } = await supabase
          .from('patients')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', monthStart)
          .lte('created_at', monthEnd);

        if (errEvo) console.warn('Error evolution:', errEvo.message);

        evolution.push({
          month: date.toLocaleDateString('es-ES', { month: 'short' }),
          count: count || 0
        });
      }

      // Alerts
      const alertList: DashboardAlert[] = [];
      if (!appointmentsToday || appointmentsToday.length === 0) {
        alertList.push({ type: 'info', title: 'Sin citas hoy', description: 'No tienes citas programadas para hoy' });
      }
      if (!recent || recent.length < 5) {
        alertList.push({ type: 'warning', title: 'Pocos pacientes nuevos', description: 'Considera dar a conocer tus servicios' });
      }
      if ((totalPatients || 0) > 0) {
        alertList.push({ type: 'warning', title: 'Seguimiento pendiente', description: 'Hay pacientes que podrían requerir seguimiento' });
      }

      setStats({
        totalPatients: totalPatients || 0,
        patientsChange: change,
        appointmentsToday: appointmentsToday?.length || 0,
        monthlyRevenue: 0,
        newPatients: newPatients || 0
      });

      setTodayAppointments(appointmentsToday || []);
      setRecentPatients(recent || []);
      setConsultationsByType(consultationTypes);
      setPatientsEvolution(evolution);
      setAlerts(alertList);

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setError(error?.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const getUserFirstName = () => {
    if (profile?.full_name) return profile.full_name.split(' ')[0];
    if (profile?.first_name) return profile.first_name;
    if (user?.email) return user.email.split('@')[0];
    return 'Doctor';
  };

  const getConsultationTypeLabel = (type?: string) => {
    if (!type) return 'Consulta';
    const labels: Record<string, string> = {
      general: 'Consulta General',
      seguimiento: 'Seguimiento',
      urgencia: 'Urgencia',
      psicologica: 'Psicológica'
    };
    return labels[type] || type;
  };

  const getAppointmentStatusColor = (status?: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    };
    return colors[status || 'pending'] || colors.pending;
  };

  const getStatusLabel = (status?: string) => {
    const labels: Record<string, string> = {
      pending: 'Pendiente', confirmed: 'Confirmada', in_progress: 'En curso',
      completed: 'Completada', cancelled: 'Cancelada'
    };
    return labels[status || 'pending'] || 'Pendiente';
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    const f = (firstName || '').charAt(0).toUpperCase();
    const l = (lastName || '').charAt(0).toUpperCase();
    return f + l || '?';
  };

  const formatTime = (time?: string) => time ? time.substring(0, 5) : '--:--';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <AlertTriangle className="w-12 h-12 text-red-500" />
        <p className="text-red-600 font-medium">{error}</p>
        <button onClick={fetchDashboardData} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {getGreeting()}, {getUserFirstName()}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Aquí está el resumen de tu actividad
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/patients/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm">
            <Plus className="w-4 h-4" />
            Nuevo Paciente
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <div key={index} className={`flex items-start gap-3 p-4 rounded-lg ${
              alert.type === 'warning'
                ? 'bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300'
                : 'bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300'
            }`}>
              {alert.type === 'warning' ? <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" /> : <Info className="w-5 h-5 mt-0.5 flex-shrink-0" />}
              <div>
                <p className="font-semibold text-sm">{alert.title}</p>
                <p className="text-sm opacity-90">{alert.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Pacientes</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{stats.totalPatients}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">+{stats.newPatients} este mes</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Citas Hoy</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{stats.appointmentsToday}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {todayAppointments.length > 0 ? 'Próxima a las ' + formatTime(todayAppointments[0]?.start_time) : 'Sin citas programadas'}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Nuevos (Mes)</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{stats.newPatients}</p>
              <p className={`flex items-center text-sm mt-1 ${stats.patientsChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {stats.patientsChange >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                {Math.abs(stats.patientsChange)}% vs mes anterior
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Plan Actual</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1 capitalize">
                {profile?.role === 'psicologo' ? 'Profesional' : 'Básico'}
              </p>
              <Link href="/billing" className="text-sm text-blue-600 hover:text-blue-700 mt-1 inline-flex items-center gap-1 transition-colors">
                Actualizar <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 hover:shadow-md transition-shadow">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Evolución de Pacientes</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={patientsEvolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => [value, 'Pacientes']} />
                <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: '#2563EB' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-md transition-shadow">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Consultas por Tipo</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={consultationsByType} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {consultationsByType.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [value, name]} contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Citas de Hoy</h3>
            <Link href="/appointments" className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">Ver todas</Link>
          </div>
          {todayAppointments.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No tienes citas programadas para hoy</p>
              <Link href="/appointments" className="inline-flex items-center gap-2 mt-3 text-blue-600 hover:text-blue-700 transition-colors">
                <Plus className="w-4 h-4" /> Agendar nueva cita
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {todayAppointments.slice(0, 5).map((appointment) => (
                <div key={appointment.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-blue-600">{formatTime(appointment.start_time)}</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{appointment.patient?.first_name || 'Paciente'} {appointment.patient?.last_name || ''}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{getConsultationTypeLabel(appointment.type)}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAppointmentStatusColor(appointment.status)}`}>{getStatusLabel(appointment.status)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Pacientes Recientes</h3>
            <Link href="/patients" className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">Ver todos</Link>
          </div>
          {recentPatients.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay pacientes registrados</p>
              <Link href="/patients/new" className="inline-flex items-center gap-2 mt-3 text-blue-600 hover:text-blue-700 transition-colors">
                <Plus className="w-4 h-4" /> Agregar paciente
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentPatients.map((patient) => (
                <Link key={patient.id} href={`/patients/${patient.id}`} className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                    {getInitials(patient.first_name, patient.last_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate">{patient.first_name || 'Sin nombre'} {patient.last_name || ''}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{patient.phone || 'Sin teléfono'}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-6 hover:shadow-md transition-shadow">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Accesos Rápidos</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link href="/patients/new" className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center"><Users className="w-6 h-6 text-blue-600" /></div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Nuevo Paciente</span>
          </Link>
          <Link href="/consultations/new" className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center"><ClipboardList className="w-6 h-6 text-green-600" /></div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Nueva Consulta</span>
          </Link>
          <Link href="/appointments/new" className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center"><Calendar className="w-6 h-6 text-purple-600" /></div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Nueva Cita</span>
          </Link>
          <Link href="/ai-assistant" className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center"><Activity className="w-6 h-6 text-orange-600" /></div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Asistente IA</span>
          </Link>
        </div>
      </Card>
    </div>
  );
}