#!/bin/bash

# Deploy Supabase Edge Functions
# CRITICAL: ALWAYS use --no-verify-jwt flag to prevent JWT auto-activation

echo "🚀 Deploying Edge Functions (NO JWT verification)"

# Deploy all functions without JWT verification
# Add --debug flag if you need to troubleshoot

supabase functions deploy instagram-webhook --no-verify-jwt
supabase functions deploy whatsapp-webhook --no-verify-jwt
supabase functions deploy messenger-webhook --no-verify-jwt
supabase functions deploy check-availability --no-verify-jwt
supabase functions deploy schedule-meeting --no-verify-jwt
supabase functions deploy detect-lead-status --no-verify-jwt
supabase functions deploy facebook-exchange-token --no-verify-jwt
supabase functions deploy instagram-exchange-token --no-verify-jwt

# Only instagram-resolve-profile requires JWT
supabase functions deploy instagram-resolve-profile

echo "✅ All functions deployed"
echo "⚠️  Remember: NEVER manually enable JWT in the Supabase dashboard!"
