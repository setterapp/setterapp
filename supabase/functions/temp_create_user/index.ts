import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    console.log('Finding existing user...');
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
      console.error('Error listing users:', userError);
      return new Response(JSON.stringify({ error: userError.message }), { status: 500 });
    }

    const user = users.users.find(u => u.email === 'pozzettimarcos@gmail.com');
    if (!user) {
      console.error('User not found');
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }

    console.log('User found:', user.id);

    // Check if subscription already exists
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (existingSub) {
      console.log('Subscription already exists:', existingSub);
      return new Response(JSON.stringify({
        success: true,
        message: 'Subscription already exists',
        subscription: existingSub
      }), { status: 200 });
    }

    console.log('Creating subscription...');
    const { data: subData, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: user.id,
        stripe_customer_id: 'cus_manual_' + user.id.substring(0, 8),
        plan: 'starter',
        status: 'active',
        messages_used: 0,
        messages_reset_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (subError) {
      console.error('Error creating subscription:', subError);
      return new Response(JSON.stringify({ error: subError.message }), { status: 500 });
    }

    console.log('✅ Subscription created successfully!');

    return new Response(JSON.stringify({
      success: true,
      user_id: user.id,
      subscription: subData,
      message: 'Subscription created successfully. User now has access.'
    }), { status: 200 });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
