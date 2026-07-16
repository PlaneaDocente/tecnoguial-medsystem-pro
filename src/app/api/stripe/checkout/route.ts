import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Falta STRIPE_SECRET_KEY");
  return new Stripe(key);
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe();
    const { priceId } = await req.json();

    if (!priceId) {
      return NextResponse.json({ error: "Falta priceId" }, { status: 400 });
    }

    // Solo se aceptan los precios configurados por nosotros.
    const allowedPrices = [
      process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC,
      process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
      process.env.NEXT_PUBLIC_STRIPE_PRICE_CLINIC,
    ].filter(Boolean);

    if (!allowedPrices.includes(priceId)) {
      return NextResponse.json({ error: "Precio no valido" }, { status: 400 });
    }

    // El userId se obtiene del token de sesion, NUNCA del body del cliente.
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Sesion invalida" }, { status: 401 });
    }

    const userId = userData.user.id;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard?success=true`,
      cancel_url: `${baseUrl}/billing`,
      customer_email: userData.user.email,
      metadata: { userId },
      subscription_data: { metadata: { userId } },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("[stripe-checkout] Error:", err?.message);
    return NextResponse.json({ error: "Error al crear la sesion de pago" }, { status: 500 });
  }
}
