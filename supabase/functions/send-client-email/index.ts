import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  type: 'credentials' | 'credentials_reset' | 'subscription_change' | 'modules_update' | 'notification' | 'invoice';
  client_id?: string;
  client_email: string;
  client_nom?: string;
  client_prenom?: string;
  entreprise_nom?: string;
  password?: string;
  panel_url?: string;
  // Pour credentials_reset
  reset_token?: string;
  // Pour subscription_change
  old_plan?: string;
  new_plan?: string;
  // Pour modules_update
  modules_added?: string[];
  modules_removed?: string[];
  // Pour notification
  notification_title?: string;
  notification_message?: string;
  // Pour invoice
  invoice_number?: string;
  invoice_amount?: number;
  invoice_url?: string;
}

function generateEmailHTML(data: EmailRequest): string {
  const clientFullName = data.client_prenom && data.client_nom
    ? `${data.client_prenom} ${data.client_nom}`
    : data.client_nom || 'Cher client';
  const currentYear = new Date().getFullYear();
  
  let subject = '';
  let htmlContent = '';

  switch (data.type) {
    case 'credentials':
      subject = `Vos identifiants de connexion - ${data.entreprise_nom || 'Crea+Entreprise'}`;
      htmlContent = generateCredentialsEmail(data, clientFullName, currentYear);
      break;
    case 'credentials_reset':
      subject = `Réinitialisation de votre mot de passe - ${data.entreprise_nom || 'Crea+Entreprise'}`;
      htmlContent = generateCredentialsResetEmail(data, clientFullName, currentYear);
      break;
    case 'subscription_change':
      subject = `Modification de votre abonnement - ${data.entreprise_nom || 'Crea+Entreprise'}`;
      htmlContent = generateSubscriptionChangeEmail(data, clientFullName, currentYear);
      break;
    case 'modules_update':
      subject = `Mise à jour de vos modules - ${data.entreprise_nom || 'Crea+Entreprise'}`;
      htmlContent = generateModulesUpdateEmail(data, clientFullName, currentYear);
      break;
    case 'notification':
      subject = data.notification_title || `Notification - ${data.entreprise_nom || 'Crea+Entreprise'}`;
      htmlContent = generateNotificationEmail(data, clientFullName, currentYear);
      break;
    case 'invoice':
      subject = `Facture ${data.invoice_number || ''} - ${data.entreprise_nom || 'Crea+Entreprise'}`;
      htmlContent = generateInvoiceEmail(data, clientFullName, currentYear);
      break;
  }

  return htmlContent;
}

function generateCredentialsEmail(data: EmailRequest, clientFullName: string, year: number): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vos identifiants de connexion</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">🎉 Bienvenue !</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Bonjour <strong style="color: #212529;">${clientFullName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Votre espace client a été créé avec succès sur <strong style="color: #667eea;">${data.entreprise_nom || 'Crea+Entreprise'}</strong>.
              </p>
              <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border: 2px solid #dee2e6; border-radius: 10px; padding: 25px; margin: 30px 0;">
                <h2 style="margin: 0 0 20px 0; color: #212529; font-size: 20px; font-weight: 600;">📋 Vos identifiants</h2>
                <div style="background: #ffffff; border-radius: 8px; padding: 20px; margin: 15px 0; border-left: 4px solid #667eea;">
                  <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 14px; font-weight: 600; text-transform: uppercase;">Email</p>
                  <p style="margin: 0; color: #212529; font-size: 18px; font-weight: 600; font-family: 'Courier New', monospace;">${data.client_email}</p>
                </div>
                <div style="background: #ffffff; border-radius: 8px; padding: 20px; margin: 15px 0; border-left: 4px solid #667eea;">
                  <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 14px; font-weight: 600; text-transform: uppercase;">Mot de passe temporaire</p>
                  <p style="margin: 0; color: #212529; font-size: 18px; font-weight: 600; font-family: 'Courier New', monospace; letter-spacing: 2px;">${data.password || '********'}</p>
                </div>
                <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0;">
                  <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.5;">
                    ⚠️ <strong>Important :</strong> Changez ce mot de passe lors de votre première connexion.
                  </p>
                </div>
              </div>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding: 30px 0;">
                    <a href="${data.panel_url || 'https://app.crea-entreprises.com/login'}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff !important; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Accéder à mon espace
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 30px 0 0 0; color: #333333; font-size: 16px;">
                Bien cordialement,<br>
                <strong style="color: #667eea;">L'équipe ${data.entreprise_nom || 'Crea+Entreprise'}</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #dee2e6;">
              <p style="margin: 0; color: #6c757d; font-size: 12px;">
                © ${year} ${data.entreprise_nom || 'Crea+Entreprise'} - Tous droits réservés
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

function generateCredentialsResetEmail(data: EmailRequest, clientFullName: string, year: number): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Réinitialisation du mot de passe</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">🔐 Réinitialisation</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px;">
                Bonjour <strong>${clientFullName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px;">
                Un nouveau mot de passe a été généré pour votre compte.
              </p>
              <div style="background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 10px; padding: 25px; margin: 30px 0;">
                <div style="background: #ffffff; border-radius: 8px; padding: 20px; margin: 15px 0; border-left: 4px solid #667eea;">
                  <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 14px; font-weight: 600; text-transform: uppercase;">Nouveau mot de passe</p>
                  <p style="margin: 0; color: #212529; font-size: 18px; font-weight: 600; font-family: 'Courier New', monospace; letter-spacing: 2px;">${data.password || '********'}</p>
                </div>
              </div>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding: 30px 0;">
                    <a href="${data.panel_url || 'https://app.crea-entreprises.com/login'}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff !important; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Se connecter
                    </a>
                  </td>
                </tr>
              </table>
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

function generateSubscriptionChangeEmail(data: EmailRequest, clientFullName: string, year: number): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Modification d'abonnement</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">📦 Modification d'abonnement</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px;">
                Bonjour <strong>${clientFullName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px;">
                Votre abonnement a été modifié avec succès.
              </p>
              <div style="background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 10px; padding: 25px; margin: 30px 0;">
                ${data.old_plan ? `<p style="margin: 0 0 10px 0; color: #6c757d;"><strong>Ancien plan:</strong> ${data.old_plan}</p>` : ''}
                ${data.new_plan ? `<p style="margin: 0 0 10px 0; color: #667eea;"><strong>Nouveau plan:</strong> ${data.new_plan}</p>` : ''}
              </div>
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

function generateModulesUpdateEmail(data: EmailRequest, clientFullName: string, year: number): string {
  const modulesAdded = data.modules_added?.length ? `<p style="margin: 10px 0; color: #10b981;"><strong>✅ Modules ajoutés:</strong> ${data.modules_added.join(', ')}</p>` : '';
  const modulesRemoved = data.modules_removed?.length ? `<p style="margin: 10px 0; color: #ef4444;"><strong>❌ Modules retirés:</strong> ${data.modules_removed.join(', ')}</p>` : '';
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Mise à jour des modules</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">⚙️ Mise à jour des modules</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px;">
                Bonjour <strong>${clientFullName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px;">
                Vos modules ont été mis à jour.
              </p>
              <div style="background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 10px; padding: 25px; margin: 30px 0;">
                ${modulesAdded}
                ${modulesRemoved}
              </div>
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

function generateNotificationEmail(data: EmailRequest, clientFullName: string, year: number): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Notification</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">📬 ${data.notification_title || 'Notification'}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px;">
                Bonjour <strong>${clientFullName}</strong>,
              </p>
              <div style="background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 10px; padding: 25px; margin: 30px 0;">
                <p style="margin: 0; color: #333333; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${data.notification_message || ''}</p>
              </div>
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

function generateInvoiceEmail(data: EmailRequest, clientFullName: string, year: number): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Facture</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">🧾 Nouvelle facture</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px;">
                Bonjour <strong>${clientFullName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px;">
                Votre facture est disponible.
              </p>
              <div style="background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 10px; padding: 25px; margin: 30px 0;">
                ${data.invoice_number ? `<p style="margin: 0 0 10px 0; color: #6c757d;"><strong>Numéro:</strong> ${data.invoice_number}</p>` : ''}
                ${data.invoice_amount ? `<p style="margin: 0 0 10px 0; color: #667eea;"><strong>Montant:</strong> ${data.invoice_amount.toFixed(2)} €</p>` : ''}
              </div>
              ${data.invoice_url ? `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding: 30px 0;">
                    <a href="${data.invoice_url}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff !important; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Voir la facture
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailData: EmailRequest = await req.json();

    if (!emailData.client_email || !emailData.type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: client_email, type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer les informations de l'entreprise si client_id est fourni
    if (emailData.client_id) {
      const { data: clientData } = await supabase
        .from('clients_with_roles')
        .select('entreprise_id, entreprise_nom, nom, prenom')
        .eq('id', emailData.client_id)
        .single();
      
      if (clientData) {
        emailData.client_nom = emailData.client_nom || clientData.nom || undefined;
        emailData.client_prenom = emailData.client_prenom || clientData.prenom || undefined;
        emailData.entreprise_nom = emailData.entreprise_nom || clientData.entreprise_nom || undefined;
      }
    }

    const emailHTML = generateEmailHTML(emailData);
    const subjectMap: Record<string, string> = {
      'credentials': `Vos identifiants de connexion - ${emailData.entreprise_nom || 'Crea+Entreprise'}`,
      'credentials_reset': `Réinitialisation de votre mot de passe - ${emailData.entreprise_nom || 'Crea+Entreprise'}`,
      'subscription_change': `Modification de votre abonnement - ${emailData.entreprise_nom || 'Crea+Entreprise'}`,
      'modules_update': `Mise à jour de vos modules - ${emailData.entreprise_nom || 'Crea+Entreprise'}`,
      'notification': emailData.notification_title || `Notification - ${emailData.entreprise_nom || 'Crea+Entreprise'}`,
      'invoice': `Facture ${emailData.invoice_number || ''} - ${emailData.entreprise_nom || 'Crea+Entreprise'}`,
    };
    const subject = subjectMap[emailData.type] || 'Notification';

    // Envoi via Resend
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';
    const IS_LOCAL = Deno.env.get('ENVIRONMENT') === 'local' || !Deno.env.get('SUPABASE_URL')?.includes('supabase.co');

    let emailSent = false;
    let emailProvider = 'none';
    let emailId = null;

    if (RESEND_API_KEY) {
      try {
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
          emailId = resendData.id;
          console.log('✅ Email envoyé via Resend:', resendData.id);
        } else {
          console.error('❌ Erreur Resend:', resendData);
          
          // Gestion spécifique de l'erreur de mode test
          if (resendData.statusCode === 403 && resendData.message?.includes('testing emails')) {
            const testModeError = `⚠️ Compte Resend en MODE TEST : Vous ne pouvez envoyer qu'à votre propre email. Pour envoyer à n'importe quelle adresse, passez en mode production : https://resend.com/domains`;
            console.error(testModeError);
            throw new Error(testModeError);
          }
          
          throw new Error(resendData.message || `Erreur Resend (${resendData.statusCode || 'unknown'}): ${JSON.stringify(resendData)}`);
        }
      } catch (resendError: unknown) {
        const errorMsg = resendError instanceof Error ? resendError.message : 'Erreur inconnue Resend';
        console.error('❌ Erreur envoi Resend:', errorMsg);
        
        // En production, si c'est une erreur de mode test, on la retourne clairement
        if (!IS_LOCAL) {
          if (errorMsg.includes('MODE TEST') || errorMsg.includes('testing emails')) {
            // Ne pas bloquer, mais logger l'erreur dans email_logs
            // L'utilisateur pourra voir le problème dans les logs
          }
          throw new Error(`Erreur envoi email via Resend: ${errorMsg}`);
        }
      }
    }

    if (!emailSent) {
      if (IS_LOCAL) {
        console.log('📧 Mode développement local - Email simulé:');
        console.log('   À:', emailData.client_email);
        console.log('   Type:', emailData.type);
        console.log('   Sujet:', subject);
        emailSent = true;
        emailProvider = 'local-simulated';
      } else {
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

    // Enregistrer l'envoi dans la base de données
    if (emailData.client_id && emailSent) {
      try {
        await supabase.from('email_logs').insert({
          client_id: emailData.client_id,
          email_type: emailData.type,
          recipient: emailData.client_email,
          subject: subject,
          provider: emailProvider,
          provider_id: emailId,
          sent_at: new Date().toISOString(),
        });
      } catch (logError) {
        console.warn('⚠️ Erreur enregistrement log email (non bloquant):', logError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: emailSent 
          ? `Email ${emailData.type} envoyé avec succès à ${emailData.client_email} via ${emailProvider}`
          : `Email préparé pour ${emailData.client_email} (mode simulation)`,
        email_provider: emailProvider,
        email_id: emailId,
        preview: IS_LOCAL ? emailHTML.substring(0, 500) : undefined,
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

