/**
 * Service pour l'envoi d'emails professionnels
 */

import { supabase } from '../lib/supabase';

export interface ClientCredentialsEmailData {
  clientEmail: string;
  clientName: string;
  clientPrenom?: string;
  entrepriseNom: string;
  email: string;
  password: string;
}

/**
 * Envoie les identifiants du client par email avec un template professionnel
 */
export async function sendClientCredentialsEmail(
  data: ClientCredentialsEmailData
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // Récupérer la session pour l'authentification
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return {
        success: false,
        error: 'Non authentifié'
      };
    }

    // Appeler l'Edge Function pour envoyer l'email
    const { data: responseData, error } = await supabase.functions.invoke('send-client-credentials', {
      body: {
        client_email: data.clientEmail,
        client_nom: data.clientName,
        client_prenom: data.clientPrenom || '',
        entreprise_nom: data.entrepriseNom,
        email: data.email,
        password: data.password,
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      console.error('Erreur envoi email:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de l\'envoi de l\'email'
      };
    }

    return {
      success: true,
      message: responseData?.message || 'Email envoyé avec succès'
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('Exception envoi email:', errorMessage);
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Génère un template HTML professionnel pour l'email d'identifiants
 */
export function generateCredentialsEmailHTML(data: ClientCredentialsEmailData): string {
  const clientFullName = data.clientPrenom 
    ? `${data.clientPrenom} ${data.clientName}`
    : data.clientName;

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
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header avec gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                🎉 Bienvenue sur votre espace client
              </h1>
            </td>
          </tr>
          
          <!-- Contenu principal -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Bonjour <strong>${clientFullName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Nous sommes ravis de vous accueillir sur <strong>${data.entrepriseNom}</strong> ! Votre espace client a été créé avec succès.
              </p>
              
              <p style="margin: 0 0 30px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Vous pouvez maintenant accéder à votre tableau de bord personnalisé et gérer tous vos documents, factures et projets en ligne.
              </p>
              
              <!-- Carte des identifiants -->
              <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border: 2px solid #dee2e6; border-radius: 10px; padding: 25px; margin: 30px 0;">
                <h2 style="margin: 0 0 20px 0; color: #212529; font-size: 20px; font-weight: 600;">
                  📋 Vos identifiants de connexion
                </h2>
                
                <div style="background: #ffffff; border-radius: 8px; padding: 20px; margin: 15px 0; border-left: 4px solid #667eea;">
                  <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    Adresse Email
                  </p>
                  <p style="margin: 0; color: #212529; font-size: 18px; font-weight: 600; font-family: 'Courier New', monospace;">
                    ${data.email}
                  </p>
                </div>
                
                <div style="background: #ffffff; border-radius: 8px; padding: 20px; margin: 15px 0; border-left: 4px solid #667eea;">
                  <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    Mot de passe temporaire
                  </p>
                  <p style="margin: 0; color: #212529; font-size: 18px; font-weight: 600; font-family: 'Courier New', monospace; letter-spacing: 2px;">
                    ${data.password}
                  </p>
                </div>
                
                <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0;">
                  <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.5;">
                    ⚠️ <strong>Important :</strong> Pour votre sécurité, veuillez changer ce mot de passe lors de votre première connexion.
                  </p>
                </div>
              </div>
              
              <!-- Bouton CTA -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding: 30px 0;">
                    <a href="${typeof window !== 'undefined' ? window.location.origin : 'https://app.crea-entreprises.com'}/login" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff !important; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
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
                <strong>L'équipe ${data.entrepriseNom}</strong>
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
                © ${new Date().getFullYear()} ${data.entrepriseNom} - Tous droits réservés
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

