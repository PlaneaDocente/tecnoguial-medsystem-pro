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
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthenticated: false,
  signOut: async () => {},
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
            console.warn("⏱️ [useAuth] Timeout. Continuando sin sesión.");
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

  const signOut = async () => {
    try { await supabase.auth.signOut(); } catch {}
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAuthenticated: !!user, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);