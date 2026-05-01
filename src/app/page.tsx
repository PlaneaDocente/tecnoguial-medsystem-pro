'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Activity } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard (auth check happens in layout)
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-lg mb-6 animate-pulse">
          <Activity className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
          TecnoGuiAl
        </h1>
        <p className="text-xl text-slate-500 dark:text-slate-400">
          MedSystem Pro
        </p>
        <div className="mt-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto"></div>
        </div>
      </div>
    </div>
  );
}
