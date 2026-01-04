import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET") ?? "setterapp-admin-2024";

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { email, plan, secret, stripe_customer_id, stripe_subscription_id } = await req.json();

    // Simple security check
    if (secret !== ADMIN_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Find user
    const { data: users } = await supabase.auth.admin.listUsers();
    let user = users?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    const results: string[] = [];

    if (!user) {
      // Create user
      const { data: newUser, error } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { created_via: "admin_fix" },
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      user = newUser.user;
      results.push(`Created user: ${user?.id}`);
    } else {
      results.push(`Found user: ${user.id}`);

      // Confirm email if needed
      if (!user.email_confirmed_at) {
        await supabase.auth.admin.updateUserById(user.id, { email_confirm: true });
        results.push("Email confirmed");
      }
    }

    // 2. Create/update subscription
    const { error: subError } = await supabase.from("subscriptions").upsert(
      {
        user_id: user!.id,
        plan: plan || "starter",
        status: "active",
        stripe_customer_id: stripe_customer_id || `manual_${user!.id}`,
        stripe_subscription_id: stripe_subscription_id || `manual_sub_${Date.now()}`,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (subError) {
      results.push(`Subscription error: ${subError.message}`);
    } else {
      results.push(`Subscription set to: ${plan || "starter"} (active)`);
    }

    // 3. Generate magic link
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: email,
      options: {
        redirectTo: "https://setterapp.ai/analytics"
      }
    });

    if (linkError) {
      results.push(`Magic link error: ${linkError.message}`);
    } else if (linkData?.properties?.action_link) {
      results.push(`Magic link: ${linkData.properties.action_link}`);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
