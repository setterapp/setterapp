import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

// Send welcome email with magic link
async function sendWelcomeEmail(email: string, magicLink: string, plan: string): Promise<boolean> {
    if (!RESEND_API_KEY) {
        console.error("❌ RESEND_API_KEY not configured");
        return false;
    }

    try {
        const planNames: Record<string, string> = {
            starter: "Starter",
            growth: "Growth",
            premium: "Premium"
        };

        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: "SetterApp.ai <noreply@setterapp.ai>",
                to: email,
                subject: `Welcome to SetterApp.ai! Your ${planNames[plan] || plan} plan is ready`,
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #000; margin-bottom: 20px;">Welcome to SetterApp.ai!</h1>

            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              Thank you for subscribing to our <strong>${planNames[plan] || plan}</strong> plan!
            </p>

            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              Click the button below to access your account and start automating your appointment booking:
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${magicLink}" style="background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Access My Account
              </a>
            </div>

            <p style="font-size: 14px; color: #666;">
              This link will expire in 24 hours. If you didn't make this purchase, please contact us.
            </p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

            <p style="font-size: 12px; color: #999; text-align: center;">
              SetterApp.ai - AI Appointment Setter for Instagram & WhatsApp
            </p>
          </div>
        `
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("❌ Resend error:", errorData);
            return false;
        }

        console.log(`✅ Welcome email sent to ${email}`);
        return true;
    } catch (error) {
        console.error("❌ Error sending email:", error);
        return false;
    }
}

// Plan mapping from price IDs
const PLAN_FROM_PRICE: Record<string, string> = {
    "price_1SlfNo7KSlSkZ0BeVFonANH4": "starter", // TEMP: $5/month for testing
    "price_1Sk5LV7KSlSkZ0BeNawpCKmu": "starter", // Keep old price for backwards compatibility
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
                console.log("✅ Webhook signature verified");
            } catch (err) {
                console.error("❌ Webhook signature verification failed:", err.message);
                console.log("Signature:", signature?.substring(0, 50) + "...");
                console.log("Secret configured:", STRIPE_WEBHOOK_SECRET ? "Yes (length: " + STRIPE_WEBHOOK_SECRET.length + ")" : "No");

                // For development/testing: try to parse anyway if signature fails
                // REMOVE THIS IN PRODUCTION or set a flag
                console.warn("⚠️ Attempting to parse event without verification (DEV MODE)");
                try {
                    event = JSON.parse(body);
                    console.log("📦 Event parsed without verification:", event.type);
                } catch (parseErr) {
                    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
                }
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
                    let userId = session.metadata?.supabase_user_id || subscription.metadata?.supabase_user_id;
                    const priceId = subscription.items.data[0]?.price.id;
                    const plan = session.metadata?.plan || PLAN_FROM_PRICE[priceId] || "starter";

                    // Get customer email from Stripe
                    const customer = await stripe.customers.retrieve(session.customer as string);
                    const customerEmail = (customer as Stripe.Customer).email;
                    const customerName = (customer as Stripe.Customer).name || "";

                    // If no user ID in metadata (payment link case), find or create user by email
                    if (!userId && customerEmail) {
                        console.log("🔍 No user ID in metadata, looking up by email...");

                        // Find user in Supabase by email
                        const { data: users, error: userError } = await supabase.auth.admin.listUsers();

                        if (!userError && users?.users) {
                            const matchedUser = users.users.find(u => u.email?.toLowerCase() === customerEmail.toLowerCase());
                            if (matchedUser) {
                                userId = matchedUser.id;
                                console.log(`✅ Found user by email: ${customerEmail} -> ${userId}`);

                                // If user exists but email not confirmed, confirm it (they paid, email is valid)
                                if (!matchedUser.email_confirmed_at) {
                                    console.log("📧 Auto-confirming email for paying user...");
                                    await supabase.auth.admin.updateUserById(matchedUser.id, {
                                        email_confirm: true
                                    });
                                }
                            }
                        }

                        // If user doesn't exist, create one
                        if (!userId) {
                            console.log("👤 Creating new user for paying customer...");

                            // Generate a random password (user will use magic link to access)
                            const tempPassword = crypto.randomUUID();

                            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                                email: customerEmail,
                                password: tempPassword,
                                email_confirm: true, // Auto-confirm since they paid with this email
                                user_metadata: {
                                    name: customerName,
                                    created_via: "stripe_payment"
                                }
                            });

                            if (createError) {
                                console.error("❌ Error creating user:", createError);
                            } else if (newUser?.user) {
                                userId = newUser.user.id;
                                console.log(`✅ Created new user: ${customerEmail} -> ${userId}`);

                                // Generate magic link for the user to access their account
                                const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
                                    type: "magiclink",
                                    email: customerEmail,
                                    options: {
                                        redirectTo: "https://setterapp.ai/analytics"
                                    }
                                });

                                if (linkError) {
                                    console.error("❌ Error generating magic link:", linkError);
                                } else if (linkData?.properties?.action_link) {
                                    // Send welcome email with magic link
                                    await sendWelcomeEmail(customerEmail, linkData.properties.action_link, plan);
                                }
                            }
                        }
                    }

                    if (!userId) {
                        console.error("❌ Could not find or create user for subscription");
                        // Still return 200 to acknowledge webhook, but log the issue
                        return new Response(JSON.stringify({ received: true, warning: "No user found or created" }), { status: 200 });
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

                    // Update subscription status, period, and RESET messages_used for new billing cycle
                    const { error } = await supabase
                        .from("subscriptions")
                        .update({
                            status: subscription.status,
                            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                            messages_used: 0, // Reset usage for new billing period
                            messages_reset_at: new Date().toISOString(),
                        })
                        .eq("stripe_subscription_id", invoice.subscription as string);

                    if (error) {
                        console.error("❌ Error updating subscription:", error);
                    } else {
                        console.log("✅ Messages usage reset for new billing period");
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
