import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req) => {
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    console.log("🧪 Testing final webhook configuration...");

    // Get the raw body
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    console.log("STRIPE_WEBHOOK_SECRET configured:", STRIPE_WEBHOOK_SECRET ? "✅ YES" : "❌ NO");
    console.log("Signature received:", signature ? "✅ YES" : "❌ NO (manual test)");

    let event: Stripe.Event;

    // Verify webhook signature if secret is set
    if (STRIPE_WEBHOOK_SECRET && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
        console.log("✅ Webhook signature verified successfully!");
      } catch (err) {
        console.error("❌ Webhook signature verification failed:", err.message);
        return new Response(JSON.stringify({
          error: "Invalid signature",
          configured: true,
          signature_received: true
        }), { status: 400 });
      }
    } else if (STRIPE_WEBHOOK_SECRET && !signature) {
      // Parse without verification for manual testing
      event = JSON.parse(body);
      console.log("⚠️ No signature provided - parsing without verification (manual test)");
    } else {
      return new Response(JSON.stringify({
        error: "STRIPE_WEBHOOK_SECRET not configured",
        configured: false
      }), { status: 500 });
    }

    console.log(`📥 Event received: ${event.type}`);

    // Test user creation logic for checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log("✅ Processing checkout session:", session.id);

      // Get customer email
      const customer = await stripe.customers.retrieve(session.customer as string);
      const customerEmail = (customer as Stripe.Customer).email;

      console.log("📧 Customer email:", customerEmail);

      if (customerEmail) {
        // Check if user exists
        const { data: users } = await supabase.auth.admin.listUsers();
        const existingUser = users?.users.find(u => u.email?.toLowerCase() === customerEmail.toLowerCase());

        if (existingUser) {
          console.log("✅ User already exists:", existingUser.id);
        } else {
          console.log("👤 Would create new user for:", customerEmail);
        }

        return new Response(JSON.stringify({
          success: true,
          event_type: event.type,
          session_id: session.id,
          customer_email: customerEmail,
          user_exists: !!existingUser,
          configured: true,
          message: "Webhook processing simulation successful!"
        }), { status: 200 });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      event_type: event.type,
      configured: true,
      message: "Webhook configured and working!"
    }), { status: 200 });

  } catch (error) {
    console.error("❌ Test failed:", error);
    return new Response(JSON.stringify({
      error: error.message,
      configured: !!STRIPE_WEBHOOK_SECRET
    }), { status: 500 });
  }
});
