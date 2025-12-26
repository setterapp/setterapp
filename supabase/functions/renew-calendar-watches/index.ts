import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * CRON Job: Renew calendar watches that are about to expire
 * Should run daily to check for watches expiring in the next 2 days
 */

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    console.log('[renew-calendar-watches] Starting renewal check...');

    // Find all Google Calendar integrations with watches about to expire (in next 2 days)
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    const { data: integrations, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('type', 'google-calendar')
      .eq('status', 'connected');

    if (error) {
      console.error('[renew-calendar-watches] Error fetching integrations:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), { status: 500 });
    }

    console.log(`[renew-calendar-watches] Found ${integrations?.length || 0} Google Calendar integrations`);

    const results: any[] = [];

    for (const integration of integrations || []) {
      const watchExpiration = integration.config?.calendar_watch_expiration;
      const userId = integration.user_id;

      // Check if watch exists and is expiring soon (or already expired)
      const needsRenewal = !watchExpiration || new Date(watchExpiration) <= twoDaysFromNow;

      if (needsRenewal) {
        console.log(`[renew-calendar-watches] Renewing watch for user ${userId}`);

        try {
          // Call setup-calendar-watch to renew
          const { data, error: invokeError } = await supabase.functions.invoke('setup-calendar-watch', {
            body: { user_id: userId }
          });

          if (invokeError) {
            results.push({ user_id: userId, success: false, error: invokeError.message });
          } else {
            results.push({ user_id: userId, success: true, events_synced: data?.events_synced });
          }
        } catch (err: any) {
          results.push({ user_id: userId, success: false, error: err.message });
        }
      } else {
        console.log(`[renew-calendar-watches] Watch for user ${userId} still valid until ${watchExpiration}`);
      }
    }

    const renewed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`[renew-calendar-watches] ✅ Complete: ${renewed} renewed, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        total_integrations: integrations?.length || 0,
        renewed,
        failed,
        results
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[renew-calendar-watches] ERROR:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
