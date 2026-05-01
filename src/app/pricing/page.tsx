"use client";

import { supabase } from "@/integrations/supabase/client";

export default function PricingPage() {

  const handleCheckout = async (priceId: string) => {
    const user = await supabase.auth.getUser();

    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      body: JSON.stringify({
        priceId,
        userId: user.data.user?.id,
      }),
    });

    const data = await res.json();
    window.location.href = data.url;
  };

  return (
    <div>
      <h1>Planes</h1>

      <button onClick={() => handleCheckout(process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC!)}>
        Comprar Básico
      </button>

      <button onClick={() => handleCheckout(process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO!)}>
        Comprar Pro
      </button>

      <button onClick={() => handleCheckout(process.env.NEXT_PUBLIC_STRIPE_PRICE_CLINIC!)}>
        Comprar Clínica
      </button>
    </div>
  );
}