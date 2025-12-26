import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface UpdateContactEmailRequest {
  user_id: string;
  conversation_id: string;
  email: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    const requestBody: UpdateContactEmailRequest = await req.json();
    const { user_id, conversation_id, email } = requestBody;

    if (!user_id || !conversation_id || !email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: user_id, conversation_id, email'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[update-contact-email] Updating email for conversation ${conversation_id}`);

    // Validar formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid email format'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener el contact_id de la conversación
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('contact_id, platform_conversation_id')
      .eq('id', conversation_id)
      .eq('user_id', user_id)
      .single();

    if (convError || !conversation) {
      console.error('[update-contact-email] Conversation not found:', convError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Conversation not found'
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!conversation.contact_id) {
      console.error('[update-contact-email] No contact_id in conversation');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No contact associated with this conversation'
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Actualizar el email del contacto
    const { data: updatedContact, error: updateError } = await supabase
      .from('contacts')
      .update({
        email: email.toLowerCase().trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversation.contact_id)
      .eq('user_id', user_id)
      .select('id, display_name, email')
      .single();

    if (updateError) {
      console.error('[update-contact-email] Update failed:', updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to update contact email'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[update-contact-email] ✅ Email updated successfully for contact ${updatedContact.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        contact: {
          id: updatedContact.id,
          name: updatedContact.display_name,
          email: updatedContact.email
        },
        message: `Email actualizado correctamente a ${updatedContact.email}`
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[update-contact-email] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
