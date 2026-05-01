import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  const body = await req.text();

  const event = JSON.parse(body); // simplificado (luego lo aseguramos)

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const userId = session.metadata.userId;

    await supabase.from("subscriptions").insert({
      user_id: userId,
      plan: session.display_items?.[0]?.plan || "basic",
      status: "active",
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
    });
  }

  return NextResponse.json({ received: true });
}