// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { Resend } from "https://esm.sh/resend@2.1.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, token, userExists, groupName, groupMemberId } = await req.json()
    
    if (!email || !token || userExists === undefined || !groupName || !groupMemberId) {
      throw new Error('Faltan datos requeridos')
    }

    const baseUrl = Deno.env.get('FRONTEND_URL')
    if (!baseUrl) {
      throw new Error('FRONTEND_URL no está configurado')
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY no está configurado')
    }

    const invitationUrl = userExists 
      ? `${baseUrl}/accept-invitation?token=${token}`
      : `${baseUrl}/register?token=${token}&email=${encodeURIComponent(email)}`;

    const resend = new Resend(resendApiKey)

    // Enviar el email
    const { data, error: resendError } = await resend.emails.send({
      from: 'Band Plan <team@band.faridproject.com>',
      to: email,
      subject: `Invitación a unirse a ${groupName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Te han invitado a unirte a ${groupName}</h1>
          
          <p>Has sido invitado a unirte al grupo ${groupName} en Band Plan.</p>
          
          ${userExists ? `
            <p>Ya tienes una cuenta en Band Plan. Haz clic en el siguiente botón para aceptar la invitación:</p>
            <a href="${invitationUrl}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
              Aceptar invitación
            </a>
          ` : `
            <p>Para unirte al grupo, primero necesitas crear una cuenta en Band Plan:</p>
            <a href="${invitationUrl}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
              Crear cuenta
            </a>
          `}
          
          <p style="color: #666; font-size: 14px; margin-top: 32px;">
            Si no esperabas esta invitación, puedes ignorar este email.
          </p>
        </div>
      `
    })

    if (resendError) {
      throw resendError
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Invitación enviada correctamente',
        emailId: data?.id
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    )
  } catch (error) {
    console.error('Error en send-invitation-email:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Error procesando la invitación'
      }),
      { 
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/send-invitation-email' \
    --header 'Authorization: Bearer ' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
