"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, AuthError } from "@supabase/supabase-js";

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  specialty: string | null;
  license_number: string | null;
  bio: string | null;
  signature_url: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  error: null,
  signIn: async () => ({ success: false }),
  signOut: async () => {},
  refreshSession: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleAuthError = useCallback((err: AuthError | Error | unknown) => {
    const message = err instanceof Error ? err.message : "Error de autenticacion";
    console.warn("[Auth] Error controlado:", message);

    if (
      message.includes("Invalid Refresh Token") ||
      message.includes("refresh_token_not_found") ||
      message.includes("JWT expired") ||
      message.includes("token is expired")
    ) {
      if (typeof window !== "undefined") {
        const keys = Object.keys(localStorage).filter((k) => k.startsWith("sb-"));
        keys.forEach((k) => localStorage.removeItem(k));
      }
      setUser(null);
      setProfile(null);
      setError("Sesion expirada. Inicia sesion nuevamente.");
    } else {
      setError(message);
    }
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, role, email, phone, specialty, license_number, bio, signature_url")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data as Profile | null);
    } catch (err) {
      console.warn("[Auth] Error cargando perfil:", err);
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  const refreshSession = useCallback(async () => {
    try {
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw refreshError;
      setUser(data.session?.user ?? null);
      if (data.session?.user) await fetchProfile(data.session.user.id);
      setError(null);
    } catch (err) {
      handleAuthError(err);
    }
  }, [handleAuthError, fetchProfile]);

  // ==========================================================
  // INICIALIZACION CON TIMEOUT DE SEGURIDAD (CRITICAL FIX)
  // ==========================================================
  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const initAuth = async () => {
      try {
        // TIMEOUT DE SEGURIDAD: si Supabase no responde en 6s, forzar fin de carga
        timeoutId = setTimeout(() => {
          if (mounted) {
            console.warn("[Auth] Timeout de inicializacion (6s). Forzando fin de carga.");
            setLoading(false);
            setError("No se pudo conectar con el servidor de autenticacion.");
          }
        }, 6000);

        const { data, error: sessionError } = await supabase.auth.getSession();

        // Si ya se disparo el timeout, no actualizar estado
        if (!mounted) return;

        if (sessionError) {
          if (
            sessionError.message?.includes("Invalid Refresh Token") ||
            sessionError.message?.includes("refresh_token_not_found")
          ) {
            handleAuthError(sessionError);
            if (mounted) setLoading(false);
            if (timeoutId) clearTimeout(timeoutId);
            return;
          }
          throw sessionError;
        }

        if (mounted) {
          setUser(data.session?.user ?? null);
          if (data.session?.user) await fetchProfile(data.session.user.id);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          handleAuthError(err);
          setLoading(false);
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    };

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        setError(null);
      } else if (event === "TOKEN_REFRESHED") {
        setUser(session?.user ?? null);
        if (session?.user) fetchProfile(session.user.id);
      } else if (session) {
        setUser(session.user);
        setError(null);
        fetchProfile(session.user.id);
      }
    });

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      listener.subscription.unsubscribe();
    };
  }, [handleAuthError, fetchProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        setError(null);
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        setUser(data.user);
        if (data.user) await fetchProfile(data.user.id);
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error al iniciar sesion";
        setError(message);
        return { success: false, error: message };
      }
    },
    [fetchProfile]
  );

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setError(null);
      if (typeof window !== "undefined") {
        const keys = Object.keys(localStorage).filter((k) => k.startsWith("sb-"));
        keys.forEach((k) => localStorage.removeItem(k));
      }
    } catch (err) {
      handleAuthError(err);
    }
  }, [handleAuthError]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, error, signIn, signOut, refreshSession, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);