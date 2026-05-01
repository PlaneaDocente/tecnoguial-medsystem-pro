'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Calendar,
  Pill,
  Stethoscope,
  CreditCard,
  FileText,
  Bot,
  Settings,
  MessageSquare,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  ChevronDown,
  Activity,
  FileSignature
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Pacientes', href: '/patients', icon: Users },
  { name: 'Consultas', href: '/consultations', icon: ClipboardList },
  { name: 'Recetas', href: '/prescriptions', icon: FileSignature },
  { name: 'Citas', href: '/appointments', icon: Calendar },
  { name: 'Medicamentos', href: '/medications', icon: Pill },
  { name: 'Enfermedades', href: '/diseases', icon: Stethoscope },
  { name: 'Facturación', href: '/billing', icon: CreditCard },
  { name: 'Reportes', href: '/reports', icon: FileText },
  { name: 'Asistente IA', href: '/ai-assistant', icon: Bot },
  { name: 'Chat', href: '/chat', icon: MessageSquare },
  { name: 'Configuración', href: '/settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState<number>(0);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user?.id)
      .eq('date', today)
      .in('status', ['pending', 'confirmed']);

    setNotifications(count || 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'doctor': return 'Doctor';
      case 'psicologo': return 'Psicólogo';
      case 'admin': return 'Administrador';
      default: return role;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200 dark:border-slate-700">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 dark:text-white text-sm">TecnoGuiAl</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">MedSystem Pro</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-auto lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold">
                {profile.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {profile.full_name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {getRoleLabel(profile.role)}
                </p>
              </div>
              <button
                onClick={() => signOut().then(() => router.push('/login'))}
                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 lg:hidden"
              >
                <Menu className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </button>

              {/* Search */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar paciente..."
                  className="bg-transparent border-none outline-none text-sm text-slate-600 dark:text-slate-300 w-64"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Notifications */}
              <button className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                {notifications > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {notifications}
                  </span>
                )}
              </button>

              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-medium">
                    {profile.full_name.charAt(0).toUpperCase()}
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1">
                    <Link
                      href="/settings"
                      className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      onClick={() => setShowUserMenu(false)}
                    >
                      Configuración
                    </Link>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        signOut().then(() => router.push('/login'));
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
