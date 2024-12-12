// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Resend } from "npm:resend@2.1.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestData = await req.json()
    console.log('Datos recibidos:', JSON.stringify(requestData, null, 2))
    
    const { email, token, userExists, groupName, groupMemberId } = requestData
    
    // Validación más detallada de cada campo
    const missingFields: string[] = []
    if (!email || typeof email !== 'string') missingFields.push('email')
    if (!token || token === null) missingFields.push('token')
    if (userExists === undefined || userExists === null) missingFields.push('userExists')
    if (!groupName || typeof groupName !== 'string') missingFields.push('groupName')
    if (!groupMemberId || typeof groupMemberId !== 'string') missingFields.push('groupMemberId')

    if (missingFields.length > 0) {
      throw new Error(`Faltan los siguientes campos requeridos o son inválidos: ${missingFields.join(', ')}. 
        Valores recibidos: 
        email: ${email}
        token: ${token}
        userExists: ${userExists}
        groupName: ${groupName}
        groupMemberId: ${groupMemberId}
      `)
    }

    const BASE_URL = new URL(
      Deno.env.get('BASE_URL') || 'https://bandplan.netlify.app'
    ).toString().replace(/\/$/, '');
    console.log('BASE_URL:', BASE_URL);

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY no está configurado')
    }
    console.log('RESEND_API_KEY está configurado');

    const invitationUrl = userExists 
      ? `${BASE_URL}/accept-invitation?token=${token}`
      : `${BASE_URL}/register?token=${token}&email=${encodeURIComponent(email)}`;
    
    console.log('URL de invitación generada:', invitationUrl);

    const resend = new Resend(resendApiKey)

    console.log('Intentando enviar email...');
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
      console.error('Error de Resend:', resendError);
      throw resendError
    }

    console.log('Email enviado exitosamente:', data);

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
    console.error('Error detallado:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Error procesando la invitación',
        stack: error.stack
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
