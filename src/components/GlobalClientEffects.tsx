'use client';

import { useEffect } from 'react';
import { useZoerIframe } from '@/hooks/useZoerIframe';

export default function GlobalClientEffects() {
  useZoerIframe();

  useEffect(() => {
    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('SW registered:', registration.scope);
          })
          .catch((error) => {
            console.log('SW registration failed:', error);
          });
      });
    }

    // Handle PWA install prompt
    let deferredPrompt: BeforeInstallPromptEvent | null = null;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
    });

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
    });
  }, []);

  return (
    <>
      {/* Offline Indicator */}
      <div
        id="offline-indicator"
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 p-4 bg-yellow-500 text-white rounded-lg shadow-lg hidden z-50"
      >
        <div className="flex items-center gap-3">
          <svg
            className="w-6 h-6 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
            />
          </svg>
          <div>
            <p className="font-semibold">Sin conexión</p>
            <p className="text-sm opacity-90">Algunas funciones pueden estar limitadas</p>
          </div>
        </div>
      </div>
    </>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
