"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
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
  Info,
} from "lucide-react";
import Link from "next/link";
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
  Cell,
} from "recharts";

// ==========================================
// TIPOS
// ==========================================
interface Patient {
  id: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
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
  type: "info" | "warning" | "error";
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

interface EvolutionPoint {
  month: string;
  count: number;
}

interface ConsultationType {
  name: string;
  value: number;
}

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"];

const CONSULTATION_LABELS: Record<string, string> = {
  general: "Consulta General",
  seguimiento: "Seguimiento",
  urgencia: "Urgencia",
  psicologica: "Psicológica",
};

const STATUS_COLORS: Record<string, string> = {
  pending:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  confirmed:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  in_progress:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed:
    "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  in_progress: "En curso",
  completed: "Completada",
  cancelled: "Cancelada",
};

// ==========================================
// UTILIDADES
// ==========================================
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 18) return "Buenas tardes";
  return "Buenas noches";
}

function formatTime(time?: string): string {
  if (!time) return "--:--";
  return time.substring(0, 5);
}

function getInitials(firstName?: string, lastName?: string): string {
  const f = (firstName || "").charAt(0).toUpperCase();
  const l = (lastName || "").charAt(0).toUpperCase();
  return f + l || "?";
}

function getConsultationTypeLabel(type?: string): string {
  if (!type) return "Consulta";
  return CONSULTATION_LABELS[type] || type;
}

function getAppointmentStatusColor(status?: string): string {
  return STATUS_COLORS[status || "pending"] || STATUS_COLORS.pending;
}

function getStatusLabel(status?: string): string {
  return STATUS_LABELS[status || "pending"] || "Pendiente";
}

// ==========================================
// SUB-COMPONENTES
// ==========================================

function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  trend: "up" | "down" | "neutral";
}) {
  return (
    <Card className="p-6 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">
            {value}
          </p>
          <div className="flex items-center gap-1 pt-1">
            {trend === "up" && (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            )}
            {trend === "down" && (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          </div>
        </div>
        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700/50 rounded-xl flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
    </Card>
  );
}

function AlertBanner({ alerts }: { alerts: DashboardAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert, index) => (
        <div
          key={index}
          className={`flex items-start gap-3 p-4 rounded-lg border ${
            alert.type === "warning"
              ? "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300"
              : "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
          }`}
        >
          {alert.type === "warning" ? (
            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          ) : (
            <Info className="w-5 h-5 mt-0.5 shrink-0" />
          )}
          <div>
            <p className="font-semibold text-sm">{alert.title}</p>
            <p className="text-sm opacity-90">{alert.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PatientsEvolutionChart({
  data,
  loading,
}: {
  data: EvolutionPoint[];
  loading: boolean;
}) {
  const hasData = useMemo(
    () => data.length > 0 && data.some((d) => d.count > 0),
    [data]
  );

  return (
    <Card className="lg:col-span-2 p-6 hover:shadow-md transition-shadow duration-200">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        Evolución de Pacientes
      </h3>
      <div className="w-full min-h-[280px] h-[280px]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Activity className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm">Sin datos suficientes</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "#64748b" }}
                axisLine={{ stroke: "#cbd5e1" }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#64748b" }}
                axisLine={{ stroke: "#cbd5e1" }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                formatter={(value: number) => [value, "Pacientes"]}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ fill: "#3B82F6", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: "#2563EB" }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

function ConsultationsTypeChart({
  data,
  loading,
}: {
  data: ConsultationType[];
  loading: boolean;
}) {
  const hasData = useMemo(
    () => data.length > 0 && data.some((d) => d.value > 0),
    [data]
  );

  return (
    <Card className="p-6 hover:shadow-md transition-shadow duration-200">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        Consultas por Tipo
      </h3>
      <div className="w-full min-h-[280px] h-[280px]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <ClipboardList className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm">Sin datos suficientes</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) =>
                  percent > 0 ? `${name} ${(percent * 100).toFixed(0)}%` : ""
                }
                labelLine={false}
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [value, name]}
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      {hasData && (
        <div className="flex flex-wrap gap-3 mt-2 justify-center">
          {data.map((entry, index) => (
            <div key={entry.name} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor: COLORS[index % COLORS.length],
                }}
              />
              <span className="text-xs text-slate-600 dark:text-slate-300">
                {entry.name} ({entry.value})
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function TodayAppointments({
  appointments,
  loading,
}: {
  appointments: Appointment[];
  loading: boolean;
}) {
  return (
    <Card className="lg:col-span-2 p-6 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Citas de Hoy
        </h3>
        <Link
          href="/appointments"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          Ver todas
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No tienes citas programadas para hoy</p>
          <Link
            href="/appointments"
            className="inline-flex items-center gap-2 mt-3 text-blue-600 hover:text-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Agendar nueva cita
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.slice(0, 5).map((appointment) => (
            <div
              key={appointment.id}
              className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-blue-600">
                    {formatTime(appointment.start_time)}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white truncate">
                    {appointment.patient?.first_name || "Paciente"}{" "}
                    {appointment.patient?.last_name || ""}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {getConsultationTypeLabel(appointment.type)}
                  </p>
                </div>
              </div>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${getAppointmentStatusColor(
                  appointment.status
                )}`}
              >
                {getStatusLabel(appointment.status)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function RecentPatientsList({
  patients,
  loading,
}: {
  patients: Patient[];
  loading: boolean;
}) {
  return (
    <Card className="p-6 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Pacientes Recientes
        </h3>
        <Link
          href="/patients"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          Ver todos
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : patients.length === 0 ? (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No hay pacientes registrados</p>
          <Link
            href="/patients/new"
            className="inline-flex items-center gap-2 mt-3 text-blue-600 hover:text-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Agregar paciente
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {patients.map((patient) => (
            <Link
              key={patient.id}
              href={`/patients/${patient.id}`}
              className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold shrink-0">
                {getInitials(patient.first_name, patient.last_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 dark:text-white truncate">
                  {patient.first_name || "Sin nombre"} {patient.last_name || ""}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                  {patient.phone || "Sin teléfono"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function QuickActions() {
  const actions = [
    { href: "/patients/new", icon: <Users className="w-6 h-6 text-blue-600" />, label: "Nuevo Paciente" },
    { href: "/consultations/new", icon: <ClipboardList className="w-6 h-6 text-green-600" />, label: "Nueva Consulta" },
    { href: "/appointments/new", icon: <Calendar className="w-6 h-6 text-purple-600" />, label: "Nueva Cita" },
    { href: "/ai-assistant", icon: <Activity className="w-6 h-6 text-orange-600" />, label: "Asistente IA" },
  ];

  return (
    <Card className="p-6 hover:shadow-md transition-shadow duration-200">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        Accesos Rápidos
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <div className="w-12 h-12 bg-white dark:bg-slate-600 rounded-xl flex items-center justify-center shadow-sm">
              {action.icon}
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 text-center">
              {action.label}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

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
    newPatients: 0,
  });
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [consultationsByType, setConsultationsByType] = useState<
    ConsultationType[]
  >([]);
  const [patientsEvolution, setPatientsEvolution] = useState<EvolutionPoint[]>(
    []
  );
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!user?.id) return;

    try {
      setError(null);
      setLoading(true);

      const today = new Date().toISOString().split("T")[0];
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      const firstDayLastMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
      )
        .toISOString()
        .split("T")[0];
      const lastDayLastMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        0
      )
        .toISOString()
        .split("T")[0];

      const [
        totalPatientsResult,
        newPatientsResult,
        lastMonthPatientsResult,
        appointmentsResult,
        recentResult,
      ] = await Promise.all([
        supabase
          .from("patients")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("patients")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", firstDayOfMonth),
        supabase
          .from("patients")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", firstDayLastMonth)
          .lte("created_at", lastDayLastMonth),
        supabase
          .from("appointments")
          .select("*, patient:patients(first_name, last_name)")
          .eq("user_id", user.id)
          .eq("date", today)
          .in("status", ["pending", "confirmed"])
          .order("start_time", { ascending: true }),
        supabase
          .from("patients")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (totalPatientsResult.error)
        console.warn("Error total patients:", totalPatientsResult.error.message);
      if (newPatientsResult.error)
        console.warn("Error new patients:", newPatientsResult.error.message);
      if (lastMonthPatientsResult.error)
        console.warn("Error last month:", lastMonthPatientsResult.error.message);
      if (appointmentsResult.error)
        console.warn("Error appointments:", appointmentsResult.error.message);
      if (recentResult.error)
        console.warn("Error recent:", recentResult.error.message);

      const totalPatients = totalPatientsResult.count || 0;
      const newPatients = newPatientsResult.count || 0;
      const lastMonthPatients = lastMonthPatientsResult.count || 0;

      let patientsChange = 0;
      if (lastMonthPatients > 0) {
        patientsChange = Math.round(
          ((newPatients - lastMonthPatients) / lastMonthPatients) * 100
        );
      } else if (newPatients > 0) {
        patientsChange = 100;
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: consultationsRaw, error: consultError } = await supabase
        .from("consultations")
        .select("type")
        .eq("user_id", user.id)
        .gte("consultation_date", thirtyDaysAgo.toISOString());

      if (consultError)
        console.warn("Error consultations:", consultError.message);

      const typeCount: Record<string, number> = {};
      (consultationsRaw || []).forEach((c) => {
        const t = c.type || "general";
        typeCount[t] = (typeCount[t] || 0) + 1;
      });

      const consultationTypes: ConsultationType[] = [
        { name: "General", value: typeCount.general || 0 },
        { name: "Seguimiento", value: typeCount.seguimiento || 0 },
        { name: "Psicológica", value: typeCount.psicologica || 0 },
        { name: "Urgencia", value: typeCount.urgencia || 0 },
      ];

      const evolutionPromises = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString();

        evolutionPromises.push(
          supabase
            .from("patients")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .gte("created_at", monthStart)
            .lte("created_at", monthEnd)
            .then((res) => ({
              month: d.toLocaleDateString("es-ES", { month: "short" }),
              count: res.count || 0,
            }))
        );
      }
      const evolution = await Promise.all(evolutionPromises);

      const alertList: DashboardAlert[] = [];
      if (!appointmentsResult.data || appointmentsResult.data.length === 0) {
        alertList.push({
          type: "info",
          title: "Sin citas hoy",
          description: "No tienes citas programadas para hoy",
        });
      }
      if (!recentResult.data || recentResult.data.length < 5) {
        alertList.push({
          type: "warning",
          title: "Pocos pacientes nuevos",
          description: "Considera dar a conocer tus servicios",
        });
      }

      setStats({
        totalPatients,
        patientsChange,
        appointmentsToday: appointmentsResult.data?.length || 0,
        monthlyRevenue: 0,
        newPatients,
      });
      setTodayAppointments(appointmentsResult.data || []);
      setRecentPatients(recentResult.data || []);
      setConsultationsByType(consultationTypes);
      setPatientsEvolution(evolution);
      setAlerts(alertList);
    } catch (err: any) {
      console.error("Error fetching dashboard data:", err);
      setError(err?.message || "Error al cargar datos del dashboard");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [user?.id, fetchDashboardData]);

  if (loading && !user) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] space-y-4">
        <AlertTriangle className="w-12 h-12 text-red-500" />
        <p className="text-red-600 font-medium text-center max-w-md">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {getGreeting()}, Dr.
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Aquí está el resumen de tu actividad
          </p>
        </div>
        <Link
          href="/patients/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Nuevo Paciente
        </Link>
      </div>

      <AlertBanner alerts={alerts} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Pacientes"
          value={stats.totalPatients}
          subtitle={`+${stats.newPatients} este mes`}
          icon={<Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
          trend={stats.newPatients > 0 ? "up" : "neutral"}
        />
        <StatCard
          title="Citas Hoy"
          value={stats.appointmentsToday}
          subtitle={
            todayAppointments.length > 0
              ? `Próxima a las ${formatTime(todayAppointments[0]?.start_time)}`
              : "Sin citas programadas"
          }
          icon={
            <Calendar className="w-6 h-6 text-green-600 dark:text-green-400" />
          }
          trend="neutral"
        />
        <StatCard
          title="Nuevos (Mes)"
          value={stats.newPatients}
          subtitle={`${Math.abs(stats.patientsChange)}% vs mes anterior`}
          icon={
            <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          }
          trend={
            stats.patientsChange > 0
              ? "up"
              : stats.patientsChange < 0
              ? "down"
              : "neutral"
          }
        />
        <StatCard
          title="Plan Actual"
          value={
            profile?.role === "psicologo" ? "Profesional" : "Básico"
          }
          subtitle="Actualizar plan"
          icon={
            <DollarSign className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          }
          trend="neutral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PatientsEvolutionChart
          data={patientsEvolution}
          loading={loading}
        />
        <ConsultationsTypeChart
          data={consultationsByType}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TodayAppointments
          appointments={todayAppointments}
          loading={loading}
        />
        <RecentPatientsList
          patients={recentPatients}
          loading={loading}
        />
      </div>

      <QuickActions />
    </div>
  );
}