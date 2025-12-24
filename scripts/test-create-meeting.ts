
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// Load environment variables from .env file
try {
    await load({ export: true, envPath: "./.env" });
} catch (e) {
    console.log("No .env file found or error loading it, using existing env vars");
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const FUNCTION_URL = Deno.env.get("FUNCTION_URL") || "http://127.0.0.1:54321/functions/v1/create-meeting";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
    // Don't exit, maybe we just want to test against local function without full env
}

async function testCreateMeeting() {
    console.log("🚀 Testing create-meeting function...");
    console.log(`URL: ${FUNCTION_URL}`);

    // Mock data - You might need to adjust these IDs to match real data in your DB
    const payload = {
        conversationId: "REPLACE_WITH_VALID_CONVERSATION_ID",
        leadName: "Test Lead",
        leadEmail: "test@example.com", // Valid email needed for calendar
        leadPhone: "+1234567890",
        agentId: "REPLACE_WITH_VALID_AGENT_ID",
        customDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        customDuration: 30
    };

    console.log("📝 Payload:", payload);

    try {
        const response = await fetch(FUNCTION_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        console.log("---------------------------------------------------");
        console.log(`Status: ${response.status}`);
        console.log("Response:", JSON.stringify(data, null, 2));
        console.log("---------------------------------------------------");

        if (response.ok) {
            console.log("✅ Test Passed: Function execution successful");
        } else {
            console.error("❌ Test Failed: Function returned error status");
        }

    } catch (error) {
        console.error("❌ Test Failed: Network or execution error", error);
    }
}

if (import.meta.main) {
    testCreateMeeting();
}
