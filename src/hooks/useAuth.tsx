"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type User = any;
type Profile = any;

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: boolean; message: string }>;
  signUp: (email: string, password: string, metadata?: any) => Promise<{ error: boolean; message: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthenticated: false,
  signIn: async () => ({ error: true, message: "No implementado" }),
  signUp: async () => ({ error: true, message: "No implementado" }),
  signOut: async () => {},
  resetPassword: async () => ({ error: true, message: "No implementado" }),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const initAuth = async () => {
      try {
        timeoutId = setTimeout(() => {
          if (mounted) {
            console.warn("⏱️ [useAuth] Timeout de autenticación. Continuando sin sesión.");
            setLoading(false);
          }
        }, 3000);

        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          try {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", session.user.id)
              .maybeSingle();
            if (mounted) setProfile(profileData);
          } catch (e) {
            console.warn("Perfil no cargado:", e);
          }
        }
      } catch (error) {
        console.error("Error de autenticación:", error);
      } finally {
        if (mounted) {
          clearTimeout(timeoutId);
          setLoading(false);
        }
      }
    };

    initAuth();

    let listener: any;
    try {
      const result = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return;
        setUser(session?.user ?? null);
        if (!session?.user) setProfile(null);
      });
      listener = result?.data?.subscription ? result : { subscription: { unsubscribe: () => {} } };
    } catch (e) {
      listener = { subscription: { unsubscribe: () => {} } };
    }

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      try { listener?.subscription?.unsubscribe(); } catch {}
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: boolean; message: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // Traducir errores comunes de Supabase al español
        let msg = error.message;
        if (msg.includes("Invalid login")) msg = "Correo o contraseña incorrectos.";
        else if (msg.includes("Email not confirmed")) msg = "Confirma tu correo electrónico antes de iniciar sesión.";
        else if (msg.includes("Supabase no está configurado")) msg = "Servidor no disponible. Contacta al administrador.";
        return { error: true, message: msg };
      }
      if (data.user) {
        setUser(data.user);
        // Cargar perfil inmediatamente después de login
        try {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", data.user.id)
            .maybeSingle();
          setProfile(profileData);
        } catch {}
      }
      return { error: false, message: "Sesión iniciada correctamente" };
    } catch (err: any) {
      return { error: true, message: err?.message || "Error al iniciar sesión" };
    }
  };

  const signUp = async (email: string, password: string, metadata?: any): Promise<{ error: boolean; message: string }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
      });
      if (error) {
        let msg = error.message;
        if (msg.includes("already registered")) msg = "Este correo ya está registrado.";
        return { error: true, message: msg };
      }
      return { error: false, message: "Registro exitoso. Revisa tu correo para confirmar." };
    } catch (err: any) {
      return { error: true, message: err?.message || "Error al registrar" };
    }
  };

  const signOut = async () => {
    try { await supabase.auth.signOut(); } catch {}
    setUser(null);
    setProfile(null);
  };

  const resetPassword = async (email: string): Promise<{ error: boolean; message: string }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
      });
      if (error) return { error: true, message: error.message };
      return { error: false, message: "Revisa tu correo para restablecer la contraseña." };
    } catch (err: any) {
      return { error: true, message: err?.message || "Error al enviar email" };
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAuthenticated: !!user, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);