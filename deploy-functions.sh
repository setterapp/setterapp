#!/bin/bash

# Deploy Supabase Edge Functions
# CRITICAL: ALWAYS use --no-verify-jwt flag to prevent JWT auto-activation

echo "🚀 Deploying Edge Functions (NO JWT verification)"

# Deploy webhook functions
supabase functions deploy instagram-webhook --no-verify-jwt
supabase functions deploy whatsapp-webhook --no-verify-jwt

# Deploy meeting/scheduling functions
supabase functions deploy check-availability --no-verify-jwt
supabase functions deploy schedule-meeting --no-verify-jwt

# Deploy calendar sync functions
supabase functions deploy sync-calendar --no-verify-jwt
supabase functions deploy google-calendar-webhook --no-verify-jwt
supabase functions deploy setup-calendar-watch --no-verify-jwt
supabase functions deploy send-meeting-reminders --no-verify-jwt

# Deploy other utility functions
supabase functions deploy update-contact-email --no-verify-jwt

# Deploy token exchange functions
supabase functions deploy facebook-exchange-token --no-verify-jwt
supabase functions deploy instagram-exchange-token --no-verify-jwt
supabase functions deploy instagram-facebook-setup --no-verify-jwt

# Only instagram-resolve-profile may use JWT
supabase functions deploy instagram-resolve-profile --no-verify-jwt

# Deploy Stripe functions
supabase functions deploy stripe-checkout --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy stripe-portal --no-verify-jwt

echo "✅ All functions deployed"
echo "⚠️  Remember: NEVER manually enable JWT in the Supabase dashboard!"
