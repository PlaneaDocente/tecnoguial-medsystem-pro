"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

type Plan = "basic" | "pro" | "clinic";

interface SubscriptionContextType {
  plan: Plan;
  status: string;
  isPro: boolean;
  isClinic: boolean;
  loading: boolean;
  canUseFeature: (feature: string) => boolean;
}

const featureMatrix: Record<string, Plan[]> = {
  ai_assistant: ["basic", "pro", "clinic"],
  chat: ["pro", "clinic"],
  reports: ["pro", "clinic"],
  billing: ["pro", "clinic"],
  multi_user: ["clinic"],
  api_access: ["clinic"],
};

const SubscriptionContext = createContext<SubscriptionContextType>({
  plan: "basic",
  status: "active",
  isPro: false,
  isClinic: false,
  loading: true,
  canUseFeature: () => false,
});

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [plan, setPlan] = useState<Plan>("basic");
  const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    
    const fetchSub = async () => {
      const { data } = await (supabase as any)
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (data) {
        setPlan(data.plan || "basic");
        setStatus(data.status || "active");
      }
      setLoading(false);
    };
    fetchSub();
  }, [user]);

  const isPro = plan === "pro" || plan === "clinic";
  const isClinic = plan === "clinic";

  const canUseFeature = (feature: string) => {
    if (status !== "active") return false;
    const allowed = featureMatrix[feature] || ["basic"];
    return allowed.includes(plan);
  };

  return (
    <SubscriptionContext.Provider value={{ plan, status, isPro, isClinic, loading, canUseFeature }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);