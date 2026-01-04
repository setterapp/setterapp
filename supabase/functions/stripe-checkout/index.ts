import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Price IDs for each tier
const PRICE_IDS: Record<string, string> = {
    starter: "price_1Sk5LV7KSlSkZ0BeNawpCKmu", // $49/month
    growth: "price_1Sk5Mc7KSlSkZ0BevmgvLlNn",
    premium: "price_1Sk5NP7KSlSkZ0BeEZjHbiOf",
};

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // Get the authorization header
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "No authorization header" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Create Supabase client with user's token
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Get user from token
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !user) {
            return new Response(
                JSON.stringify({ error: "Invalid token" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Parse request body
        const { plan, success_url, cancel_url } = await req.json();

        if (!plan || !PRICE_IDS[plan]) {
            return new Response(
                JSON.stringify({ error: "Invalid plan" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const priceId = PRICE_IDS[plan];

        // Initialize Stripe
        const stripe = new Stripe(STRIPE_SECRET_KEY, {
            apiVersion: "2023-10-16",
        });

        // Check if user already has a subscription
        const { data: existingSub } = await supabase
            .from("subscriptions")
            .select("stripe_customer_id")
            .eq("user_id", user.id)
            .single();

        let customerId = existingSub?.stripe_customer_id;

        // Create or retrieve Stripe customer
        if (!customerId || customerId.startsWith("cus_manual")) {
            // Search for existing customer by email
            const customers = await stripe.customers.list({
                email: user.email,
                limit: 1,
            });

            if (customers.data.length > 0) {
                customerId = customers.data[0].id;
            } else {
                // Create new customer
                const customer = await stripe.customers.create({
                    email: user.email,
                    metadata: {
                        supabase_user_id: user.id,
                    },
                });
                customerId = customer.id;
            }
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: "subscription",
            payment_method_types: ["card"],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: success_url || `${req.headers.get("origin")}/analytics?success=true`,
            cancel_url: cancel_url || `${req.headers.get("origin")}/pricing?canceled=true`,
            subscription_data: {
                metadata: {
                    supabase_user_id: user.id,
                    plan: plan,
                },
            },
            metadata: {
                supabase_user_id: user.id,
                plan: plan,
            },
        });

        return new Response(
            JSON.stringify({ url: session.url, sessionId: session.id }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        );

    } catch (error) {
        console.error("Stripe checkout error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
