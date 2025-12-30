import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Plan mapping from price IDs
const PLAN_FROM_PRICE: Record<string, string> = {
  "price_1Sk5LV7KSlSkZ0BeNawpCKmu": "starter",
  "price_1Sk5Mc7KSlSkZ0BevmgvLlNn": "growth",
  "price_1Sk5NP7KSlSkZ0BeEZjHbiOf": "premium",
};

Deno.serve(async (req) => {
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Get the raw body
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event: Stripe.Event;

    // Verify webhook signature if secret is set
    if (STRIPE_WEBHOOK_SECRET && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        console.error("Webhook signature verification failed:", err.message);
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
      }
    } else {
      // Parse without verification (for testing)
      event = JSON.parse(body);
      console.warn("⚠️ Webhook signature not verified - no secret configured");
    }

    console.log(`📥 Stripe webhook received: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("✅ Checkout session completed:", session.id);

        if (session.mode === "subscription" && session.subscription) {
          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const userId = session.metadata?.supabase_user_id || subscription.metadata?.supabase_user_id;
          const priceId = subscription.items.data[0]?.price.id;
          const plan = session.metadata?.plan || PLAN_FROM_PRICE[priceId] || "starter";

          if (!userId) {
            console.error("❌ No user ID in metadata");
            return new Response(JSON.stringify({ error: "No user ID" }), { status: 400 });
          }

          // Upsert subscription record
          const { error } = await supabase
            .from("subscriptions")
            .upsert({
              user_id: userId,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: subscription.id,
              stripe_price_id: priceId,
              status: subscription.status,
              plan: plan,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end,
            }, { onConflict: "user_id" });

          if (error) {
            console.error("❌ Error upserting subscription:", error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
          }

          console.log(`✅ Subscription created for user ${userId}: ${plan}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("🔄 Subscription updated:", subscription.id);

        const priceId = subscription.items.data[0]?.price.id;
        const plan = PLAN_FROM_PRICE[priceId] || "starter";

        // Update subscription record
        const { error } = await supabase
          .from("subscriptions")
          .update({
            stripe_price_id: priceId,
            status: subscription.status,
            plan: plan,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            canceled_at: subscription.canceled_at
              ? new Date(subscription.canceled_at * 1000).toISOString()
              : null,
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          console.error("❌ Error updating subscription:", error);
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        console.log(`✅ Subscription updated: ${subscription.id} -> ${subscription.status}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("❌ Subscription deleted:", subscription.id);

        // Mark subscription as canceled
        const { error } = await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          console.error("❌ Error canceling subscription:", error);
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        console.log(`✅ Subscription canceled: ${subscription.id}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log("⚠️ Payment failed for invoice:", invoice.id);

        if (invoice.subscription) {
          // Update subscription status to past_due
          const { error } = await supabase
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("stripe_subscription_id", invoice.subscription as string);

          if (error) {
            console.error("❌ Error updating subscription:", error);
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log("✅ Payment succeeded for invoice:", invoice.id);

        if (invoice.subscription) {
          // Get the latest subscription data
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);

          // Update subscription status and period
          const { error } = await supabase
            .from("subscriptions")
            .update({
              status: subscription.status,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq("stripe_subscription_id", invoice.subscription as string);

          if (error) {
            console.error("❌ Error updating subscription:", error);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });

  } catch (error) {
    console.error("❌ Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});
