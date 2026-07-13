'use client';

import * as React from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/hooks/useAuth';
import GlobalClientEffects from '@/components/GlobalClientEffects';
import PWARegister from '@/components/PWARegister';

type ThemeProviderProps = React.ComponentProps<typeof ThemeProvider>;

export function Providers({ children, ...props }: ThemeProviderProps) {
  return (
    <AuthProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange={false}
        {...props}
      >
        {children}
        <GlobalClientEffects />
      </ThemeProvider>
      <Toaster position="top-right" richColors closeButton />
      <PWARegister />
    </AuthProvider>
  );
}