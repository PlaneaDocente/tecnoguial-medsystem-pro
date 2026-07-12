"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";

// ═══════════════════════════════════════════════════════════
// DECLARACIÓN DE TIPOS PARA LA API DE ELECTRON
// ═══════════════════════════════════════════════════════════
declare global {
  interface Window {
    electronAPI?: {
      print: {
        ticket: (data: PrintTicketData) => Promise<{ success: boolean; error?: string }>;
        recipe: (data: PrintRecipeData) => Promise<{ success: boolean; error?: string }>;
      };
      store: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<void>;
        delete: (key: string) => Promise<void>;
      };
      notification: {
        show: (title: string, body: string) => void;
      };
      on: (channel: ReceiveChannel, callback: (...args: any[]) => void) => () => void;
      platform: string;
      versions: {
        app: string;
        electron: string;
        node: string;
        chrome: string;
      };
    };
  }
}

// ─── Tipos de datos para impresión ───
interface PrintTicketData {
  businessName: string;
  ticketNumber: string;
  date: string;
  items: Array<{
    name: string;
    qty: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  footer?: string;
}

interface PrintRecipeData {
  doctorName: string;
  doctorLicense: string;
  patientName: string;
  patientAge: string;
  date: string;
  diagnosis: string;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
  }>;
  recommendations: string;
  signature?: string;
}

// ─── Canales IPC que puede recibir el renderer ───
type ReceiveChannel =
  | "navigate-to"
  | "app:logout"
  | "app:sync-supabase"
  | "app:offline-mode"
  | "app:print"
  | "app:update-available"
  | "app:update-downloaded";

// ═══════════════════════════════════════════════════════════
// HOOK useElectron — Compatible con Next.js App Router
// ═══════════════════════════════════════════════════════════
export function useElectron() {
  const router = useRouter();
  const [isElectron, setIsElectron] = useState(false);

  // Detectar si estamos corriendo dentro de Electron
  useEffect(() => {
    const check = typeof window !== "undefined" && !!window.electronAPI;
    setIsElectron(check);
  }, []);

  // ─── Escuchar navegación desde el menú nativo de Electron ───
  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;

    const unsubscribe = window.electronAPI.on("navigate-to", (route: string) => {
      // En Next.js App Router usamos router.push()
      // Si falla (ej. ruta externa), usamos window.location como fallback
      if (route.startsWith("http")) {
        window.open(route, "_blank");
      } else {
        router.push(route);
      }
    });

    return unsubscribe;
  }, [isElectron, router]);

  // ─── Escuchar logout desde menú nativo ───
  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;

    const unsubscribe = window.electronAPI.on("app:logout", () => {
      // Limpiar sesión y redirigir a login
      localStorage.removeItem("supabase.auth.token");
      document.cookie = "supabase-auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      router.push("/login");
    });

    return unsubscribe;
  }, [isElectron, router]);

  // ─── Escuchar modo offline desde menú nativo ───
  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;

    const unsubscribe = window.electronAPI.on("app:offline-mode", (enabled: boolean) => {
      if (enabled) {
        console.log("🔌 Modo offline activado desde menú nativo");
        // Aquí puedes disparar un estado global o toast
      } else {
        console.log("🌐 Modo online restaurado");
      }
    });

    return unsubscribe;
  }, [isElectron]);

  // ─── Escuchar actualizaciones disponibles ───
  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;

    const unsubscribe = window.electronAPI.on("app:update-available", () => {
      console.log("📦 Nueva versión disponible");
    });

    return unsubscribe;
  }, [isElectron]);

  // ═══════════════════════════════════════════════════════════
  // FUNCIONES EXPUESTAS
  // ═══════════════════════════════════════════════════════════

  /** Imprimir ticket POS (80mm térmica) */
  const printTicket = useCallback(
    async (data: PrintTicketData) => {
      if (!isElectron || !window.electronAPI) {
        // Fallback web: abrir ventana de impresión del navegador
        window.print();
        return { success: true as const };
      }
      return window.electronAPI.print.ticket(data);
    },
    [isElectron]
  );

  /** Imprimir receta médica (carta) */
  const printRecipe = useCallback(
    async (data: PrintRecipeData) => {
      if (!isElectron || !window.electronAPI) {
        window.print();
        return { success: true as const };
      }
      return window.electronAPI.print.recipe(data);
    },
    [isElectron]
  );

  /** Mostrar notificación nativa del sistema */
  const showNotification = useCallback(
    (title: string, body: string) => {
      if (isElectron && window.electronAPI) {
        window.electronAPI.notification.show(title, body);
      } else if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body });
      } else if ("Notification" in window && Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            new Notification(title, { body });
          }
        });
      }
    },
    [isElectron]
  );

  /** Minimizar ventana (solo Electron) */
  const minimizeWindow = useCallback(() => {
    if (isElectron && window.electronAPI) {
      // No expuesto directamente, pero puedes agregarlo a preload si lo necesitas
      console.log("Minimizar no implementado en preload");
    }
  }, [isElectron]);

  /** Solicitar permiso de notificaciones (web) */
  const requestNotificationPermission = useCallback(async () => {
    if (!isElectron && "Notification" in window) {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }
    return isElectron; // En Electron siempre disponible
  }, [isElectron]);

  return {
    // ─── Estado ───
    isElectron,
    isWindows: isElectron && window.electronAPI?.platform === "win32",
    isMac: isElectron && window.electronAPI?.platform === "darwin",
    isLinux: isElectron && window.electronAPI?.platform === "linux",

    // ─── Versiones ───
    versions: isElectron ? window.electronAPI?.versions : null,

    // ─── APIs de impresión ───
    printTicket,
    printRecipe,

    // ─── Notificaciones ───
    showNotification,
    requestNotificationPermission,

    // ─── Storage local seguro (solo Electron) ───
    store: isElectron && window.electronAPI ? window.electronAPI.store : null,

    // ─── Utilidades ───
    minimizeWindow,
  };
}

// ═══════════════════════════════════════════════════════════
// HOOK AUXILIAR: useElectronStore (wrapper tipado del store)
// ═══════════════════════════════════════════════════════════
export function useElectronStore() {
  const { isElectron, store } = useElectron();

  const getItem = useCallback(
    async <T = any>(key: string, defaultValue?: T): Promise<T | undefined> => {
      if (!isElectron || !store) return defaultValue;
      try {
        const value = await store.get(key);
        return value !== undefined ? value : defaultValue;
      } catch {
        return defaultValue;
      }
    },
    [isElectron, store]
  );

  const setItem = useCallback(
    async <T = any>(key: string, value: T): Promise<boolean> => {
      if (!isElectron || !store) {
        // Fallback: localStorage en web
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch {
          return false;
        }
      }
      try {
        await store.set(key, value);
        return true;
      } catch {
        return false;
      }
    },
    [isElectron, store]
  );

  const removeItem = useCallback(
    async (key: string): Promise<boolean> => {
      if (!isElectron || !store) {
        localStorage.removeItem(key);
        return true;
      }
      try {
        await store.delete(key);
        return true;
      } catch {
        return false;
      }
    },
    [isElectron, store]
  );

  return { getItem, setItem, removeItem, isAvailable: isElectron && !!store };
}