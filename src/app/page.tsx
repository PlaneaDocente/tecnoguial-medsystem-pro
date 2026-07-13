'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Activity } from 'lucide-react';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
        <Activity className="w-7 h-7 text-white animate-pulse" />
      </div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">TecnoGuiAI MedSystem Pro</h1>
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-4" />
      <p className="text-sm text-slate-500 dark:text-slate-400">Verificando sesión...</p>
    </div>
  );
}