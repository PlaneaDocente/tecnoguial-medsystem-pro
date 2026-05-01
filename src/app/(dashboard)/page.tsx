import { supabase } from "@/integrations/supabase/client";

export default async function Dashboard() {
  const { data: userData } = await supabase.auth.getUser();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userData.user?.id)
    .single();

  if (sub?.plan !== "pro") {
    return <div>🔒 Necesitas plan PRO para acceder</div>;
  }

  return <div>🔥 Bienvenido al panel PRO</div>;
}