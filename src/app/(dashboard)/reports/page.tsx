'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  FileText,
  Download,
  Calendar,
  Users,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  Filter
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { toast } from 'sonner';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function ReportsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('month');
  const [stats, setStats] = useState({
    totalPatients: 0,
    newPatients: 0,
    totalConsultations: 0,
    consultationsByType: [] as { name: string; value: number }[],
    patientsByMonth: [] as { month: string; count: number }[],
    topDiagnoses: [] as { name: string; count: number }[]
  });

  useEffect(() => {
    if (user) fetchReportData();
  }, [user, dateRange]);

  const fetchReportData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const now = new Date();
      let startDate: Date;

      switch (dateRange) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      // Total patients
      const { count: totalPatients } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // New patients in period
      const { count: newPatients } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString());

      // Total consultations
      const { count: totalConsultations } = await supabase
        .from('consultations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('consultation_date', startDate.toISOString());

      // Consultations by type
      const { data: consultations } = await supabase
        .from('consultations')
        .select('type')
        .eq('user_id', user.id)
        .gte('consultation_date', startDate.toISOString());

      const typeCount: Record<string, number> = {};
      consultations?.forEach(c => {
        typeCount[c.type] = (typeCount[c.type] || 0) + 1;
      });

      const consultationsByType = [
        { name: 'General', value: typeCount.general || 0 },
        { name: 'Seguimiento', value: typeCount.seguimiento || 0 },
        { name: 'Psicológica', value: typeCount.psicologica || 0 },
        { name: 'Urgencia', value: typeCount.urgencia || 0 }
      ];

      // Patients by month (last 6 months)
      const patientsByMonth: { month: string; count: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        const { count } = await supabase
          .from('patients')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString());

        patientsByMonth.push({
          month: date.toLocaleDateString('es-ES', { month: 'short' }),
          count: count || 0
        });
      }

      // Top diagnoses
      const { data: allConsultations } = await supabase
        .from('consultations')
        .select('diagnosis_names')
        .eq('user_id', user.id)
        .gte('consultation_date', startDate.toISOString());

      const diagnosisCount: Record<string, number> = {};
      allConsultations?.forEach(c => {
        c.diagnosis_names?.forEach((name: string) => {
          diagnosisCount[name] = (diagnosisCount[name] || 0) + 1;
        });
      });

      const topDiagnoses = Object.entries(diagnosisCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setStats({
        totalPatients: totalPatients || 0,
        newPatients: newPatients || 0,
        totalConsultations: totalConsultations || 0,
        consultationsByType,
        patientsByMonth,
        topDiagnoses
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    if (!user) return;

    toast.promise(async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const { data: patients } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const doc = new jsPDF();

      // Header
      doc.setFontSize(20);
      doc.setTextColor(0, 102, 204);
      doc.text('Reporte de Estadisticas', 105, 20, { align: 'center' });

      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(`Generado por: ${profile?.full_name || 'Doctor'}`, 105, 30, { align: 'center' });
      doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 105, 38, { align: 'center' });

      // Summary
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('Resumen General', 15, 55);

      doc.setFontSize(10);
      doc.setTextColor(60);
      doc.text(`Total Pacientes: ${stats.totalPatients}`, 15, 65);
      doc.text(`Nuevos Pacientes: ${stats.newPatients}`, 15, 72);
      doc.text(`Total Consultas: ${stats.totalConsultations}`, 15, 79);

      // Patients table
      if (patients && patients.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text('Lista de Pacientes', 15, 95);

        const tableData = patients.slice(0, 30).map(p => [
          p.first_name + ' ' + p.last_name,
          p.phone || 'N/A',
          p.blood_type,
          new Date(p.created_at).toLocaleDateString('es-ES')
        ]);

        (doc as any).autoTable({
          startY: 100,
          head: [['Nombre', 'Telefono', 'Tipo Sangre', 'Fecha Registro']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [0, 102, 204] }
        });
      }

      doc.save(`reporte_${new Date().toISOString().split('T')[0]}.pdf`);
    }, {
      loading: 'Generando PDF...',
      success: 'PDF generado exitosamente',
      error: 'Error al generar PDF'
    });
  };

  const exportCSV = () => {
    if (!user) return;

    toast.promise(async () => {
      const { data: patients } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!patients || patients.length === 0) {
        throw new Error('No hay datos para exportar');
      }

      const headers = ['Nombre', 'Apellidos', 'Telefono', 'Email', 'Tipo Sangre', 'Fecha Nacimiento', 'Fecha Registro'];
      const rows = patients.map(p => [
        p.first_name,
        p.last_name,
        p.phone || '',
        p.email || '',
        p.blood_type,
        p.birth_date || '',
        new Date(p.created_at).toLocaleDateString('es-ES')
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pacientes_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }, {
      loading: 'Exportando CSV...',
      success: 'CSV exportado exitosamente',
      error: 'Error al exportar CSV'
    });
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reportes</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Estadísticas y análisis de tu consultorio
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} className="gap-2">
            <Download className="w-4 h-4" />
            Exportar CSV
          </Button>
          <Button onClick={exportPDF} className="gap-2">
            <FileText className="w-4 h-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-sm text-slate-500">Periodo:</span>
          </div>
          <div className="flex gap-2">
            {[
              { value: 'week', label: 'Última semana' },
              { value: 'month', label: 'Este mes' },
              { value: 'quarter', label: 'Trimestre' },
              { value: 'year', label: 'Este año' }
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setDateRange(option.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  dateRange === option.value
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Pacientes</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                {stats.totalPatients}
              </p>
              <p className="text-sm text-green-600 mt-1">
                +{stats.newPatients} nuevos
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Consultas</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                {stats.totalConsultations}
              </p>
              <p className="text-sm text-slate-500 mt-1">en el periodo</p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Tasa de Crecimiento</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                {stats.totalPatients > 0
                  ? ((stats.newPatients / stats.totalPatients) * 100).toFixed(1)
                  : 0}%
              </p>
              <p className="text-sm text-slate-500 mt-1">nuevos pacientes</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patients Evolution */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Evolución de Pacientes
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.patientsByMonth}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis dataKey="month" className="text-xs fill-slate-500" />
                <YAxis className="text-xs fill-slate-500" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6' }}
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
                  data={stats.consultationsByType}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {stats.consultationsByType.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Top Diagnoses */}
        <Card className="p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Diagnósticos Más Comunes
          </h3>
          {stats.topDiagnoses.length === 0 ? (
            <p className="text-center text-slate-500 py-8">
              No hay suficientes datos para mostrar diagnósticos
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topDiagnoses} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis type="number" className="text-xs fill-slate-500" />
                  <YAxis dataKey="name" type="category" width={150} className="text-xs fill-slate-500" />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
