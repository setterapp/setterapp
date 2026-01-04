import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

Deno.serve(async (req) => {
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    console.log("Testing webhook...");
    console.log("STRIPE_WEBHOOK_SECRET configured:", STRIPE_WEBHOOK_SECRET ? "YES" : "NO");
    console.log("Signature received:", signature ? "YES" : "NO");

    if (!STRIPE_WEBHOOK_SECRET) {
      return new Response(JSON.stringify({
        error: "STRIPE_WEBHOOK_SECRET not configured",
        configured: false
      }), { status: 500 });
    }

    if (!signature) {
      return new Response(JSON.stringify({
        error: "No signature provided",
        configured: true
      }), { status: 400 });
    }

    try {
      const event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
      return new Response(JSON.stringify({
        success: true,
        event_type: event.type,
        configured: true,
        message: "Webhook signature verified successfully!"
      }), { status: 200 });
    } catch (err) {
      return new Response(JSON.stringify({
        error: `Signature verification failed: ${err.message}`,
        configured: true
      }), { status: 400 });
    }

  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
      configured: STRIPE_WEBHOOK_SECRET ? true : false
    }), { status: 500 });
  }
});
