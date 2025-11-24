import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  client_email: string;
  client_nom: string;
  client_prenom?: string;
  entreprise_nom: string;
  email: string;
  password: string;
}

function generateProfessionalEmailHTML(data: EmailRequest): string {
  const clientFullName = data.client_prenom
    ? `${data.client_prenom} ${data.client_nom}`
    : data.client_nom;

  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vos identifiants d'accès</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
          
          <!-- Header avec gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">
                🎉 Bienvenue sur votre espace client
              </h1>
            </td>
          </tr>
          
          <!-- Contenu principal -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Bonjour <strong style="color: #212529;">${clientFullName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Nous sommes ravis de vous accueillir sur <strong style="color: #667eea;">${data.entreprise_nom}</strong> ! Votre espace client a été créé avec succès.
              </p>
              
              <p style="margin: 0 0 30px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Vous pouvez maintenant accéder à votre tableau de bord personnalisé et gérer tous vos documents, factures et projets en ligne.
              </p>
              
              <!-- Carte des identifiants -->
              <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border: 2px solid #dee2e6; border-radius: 10px; padding: 25px; margin: 30px 0;">
                <h2 style="margin: 0 0 20px 0; color: #212529; font-size: 20px; font-weight: 600;">
                  📋 Vos identifiants de connexion
                </h2>
                
                <div style="background: #ffffff; border-radius: 8px; padding: 20px; margin: 15px 0; border-left: 4px solid #667eea; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                  <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    Adresse Email
                  </p>
                  <p style="margin: 0; color: #212529; font-size: 18px; font-weight: 600; font-family: 'Courier New', monospace; word-break: break-all;">
                    ${data.email}
                  </p>
                </div>
                
                <div style="background: #ffffff; border-radius: 8px; padding: 20px; margin: 15px 0; border-left: 4px solid #667eea; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                  <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    Mot de passe temporaire
                  </p>
                  <p style="margin: 0; color: #212529; font-size: 18px; font-weight: 600; font-family: 'Courier New', monospace; letter-spacing: 2px; word-break: break-all;">
                    ${data.password}
                  </p>
                </div>
                
                <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0;">
                  <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.5;">
                    ⚠️ <strong>Important :</strong> Pour votre sécurité, veuillez changer ce mot de passe lors de votre première connexion.
                  </p>
                </div>
              </div>
              
              <!-- Message de bienvenue -->
              <div style="background: #e7f3ff; border-left: 4px solid #2196F3; border-radius: 6px; padding: 15px; margin: 25px 0;">
                <p style="margin: 0; color: #0c5460; font-size: 14px; line-height: 1.6;">
                  💡 <strong>Conseil :</strong> Enregistrez cet email dans un endroit sûr pour retrouver facilement vos identifiants.
                </p>
              </div>
              
              <!-- Bouton CTA -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding: 30px 0;">
                    <a href="https://app.crea-entreprises.com/login" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff !important; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                      Accéder à mon espace client
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0 0; color: #6c757d; font-size: 14px; line-height: 1.6;">
                Si vous avez des questions ou besoin d'assistance, n'hésitez pas à nous contacter via votre espace client ou par email.
              </p>
              
              <p style="margin: 30px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Bien cordialement,<br>
                <strong style="color: #667eea;">L'équipe ${data.entreprise_nom}</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #dee2e6;">
              <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 12px; line-height: 1.5;">
                Cet email a été envoyé automatiquement suite à la création de votre espace client.<br>
                Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet email.
              </p>
              <p style="margin: 0; color: #6c757d; font-size: 12px;">
                © ${currentYear} ${data.entreprise_nom} - Tous droits réservés
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user authentication
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const emailData: EmailRequest = await req.json();

    // Validate required fields
    if (!emailData.client_email || !emailData.client_nom || !emailData.entreprise_nom || !emailData.email || !emailData.password) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate HTML email
    const emailHTML = generateProfessionalEmailHTML(emailData);
    const subject = `Bienvenue sur votre espace client - ${emailData.entreprise_nom}`;

    // ✅ Tenter d'envoyer l'email via Resend si configuré
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';
    const IS_LOCAL = Deno.env.get('ENVIRONMENT') === 'local' || !Deno.env.get('SUPABASE_URL')?.includes('supabase.co');

    let emailSent = false;
    let emailProvider = 'none';

    if (RESEND_API_KEY) {
      try {
        console.log('📧 Tentative d\'envoi via Resend...');
        
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: RESEND_FROM_EMAIL,
            to: emailData.client_email,
            subject: subject,
            html: emailHTML,
          }),
        });

        const resendData = await resendResponse.json();

        if (resendResponse.ok && resendData.id) {
          emailSent = true;
          emailProvider = 'resend';
          console.log('✅ Email envoyé via Resend:', resendData.id);
        } else {
          console.error('❌ Erreur Resend:', resendData);
          throw new Error(resendData.message || 'Erreur lors de l\'envoi via Resend');
        }
      } catch (resendError: unknown) {
        const errorMsg = resendError instanceof Error ? resendError.message : 'Erreur inconnue Resend';
        console.error('❌ Erreur envoi Resend:', errorMsg);
        
        // En développement local, continuer avec le fallback
        if (!IS_LOCAL) {
          throw new Error(`Erreur envoi email via Resend: ${errorMsg}`);
        }
        // En local, on continue avec le fallback
      }
    }

    // ✅ Fallback pour développement local ou si Resend n'est pas configuré
    if (!emailSent) {
      if (IS_LOCAL) {
        console.log('📧 Mode développement local - Email simulé:');
        console.log('   À:', emailData.client_email);
        console.log('   Sujet:', subject);
        console.log('   📄 Email HTML généré (preview):', emailHTML.substring(0, 200) + '...');
        console.log('   💡 Pour activer l\'envoi réel, configurez RESEND_API_KEY dans .env');
        
        // En local, considérer comme "envoyé" pour permettre les tests
        emailSent = true;
        emailProvider = 'local-simulated';
      } else {
        // En production sans Resend, retourner une erreur
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Service d\'email non configuré. Veuillez configurer RESEND_API_KEY.',
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: emailSent 
          ? `Email envoyé avec succès à ${emailData.client_email} via ${emailProvider}`
          : `Email préparé pour ${emailData.client_email} (mode simulation)`,
        email_provider: emailProvider,
        preview: IS_LOCAL ? emailHTML.substring(0, 500) : undefined, // Preview seulement en local
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('❌ Erreur envoi email:', errorMessage);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

