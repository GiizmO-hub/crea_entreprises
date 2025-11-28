import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, resend-signature',
};

/**
 * Edge Function pour recevoir les webhooks Resend
 * 
 * Événements supportés :
 * - email.sent - Email envoyé
 * - email.delivered - Email livré
 * - email.delivery_delayed - Livraison retardée
 * - email.complained - Email marqué comme spam
 * - email.bounced - Email rebondi
 * - email.opened - Email ouvert
 * - email.clicked - Lien cliqué dans l'email
 */

interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    [key: string]: any;
  };
}

/**
 * Vérifier la signature du webhook Resend
 */
async function verifyResendSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    // Resend utilise HMAC-SHA256 pour signer les webhooks
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Comparaison sécurisée des signatures
    return expectedSignature.toLowerCase() === signature.toLowerCase();
  } catch (error) {
    console.error('Erreur vérification signature:', error);
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const RESEND_WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET');

    // Lire le body
    const body = await req.text();
    const signature = req.headers.get('resend-signature') || req.headers.get('Resend-Signature');

    // Vérifier la signature si la clé est configurée
    if (RESEND_WEBHOOK_SECRET && signature) {
      const isValid = await verifyResendSignature(body, signature, RESEND_WEBHOOK_SECRET);
      if (!isValid) {
        console.warn('⚠️ Signature webhook Resend invalide');
        return new Response(
          JSON.stringify({ error: 'Signature invalide' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (!RESEND_WEBHOOK_SECRET) {
      console.warn('⚠️ RESEND_WEBHOOK_SECRET non configuré - webhooks non vérifiés');
    }

    // Parser l'événement
    const event: ResendWebhookEvent = JSON.parse(body);

    console.log('📬 Webhook Resend reçu:', event.type, event.data.email_id);

    // Mettre à jour email_logs avec le statut
    if (event.data.email_id) {
      try {
        // Rechercher le log par provider_id (email_id de Resend)
        const { data: existingLog } = await supabase
          .from('email_logs')
          .select('id, client_id')
          .eq('provider_id', event.data.email_id)
          .single();

        if (existingLog) {
          // Mettre à jour le statut dans email_logs
          const updateData: any = {
            updated_at: new Date().toISOString(),
          };

          // Ajouter des informations selon le type d'événement
          switch (event.type) {
            case 'email.delivered':
              updateData.error_message = null; // Effacer les erreurs précédentes
              break;
            case 'email.bounced':
              updateData.error_message = `Email rebondi: ${event.data.reason || 'Raison inconnue'}`;
              break;
            case 'email.complained':
              updateData.error_message = 'Email marqué comme spam par le destinataire';
              break;
            case 'email.opened':
              // Peut-être créer une table email_events pour tracker les ouvertures
              break;
          }

          await supabase
            .from('email_logs')
            .update(updateData)
            .eq('id', existingLog.id);

          console.log(`✅ Log email mis à jour pour ${event.type}:`, existingLog.id);
        } else {
          console.warn('⚠️ Log email non trouvé pour:', event.data.email_id);
        }
      } catch (updateError) {
        console.error('❌ Erreur mise à jour log:', updateError);
        // Ne pas bloquer le webhook si la mise à jour échoue
      }
    }

    // Traiter les événements spécifiques
    switch (event.type) {
      case 'email.sent':
        console.log('📧 Email envoyé:', event.data.email_id);
        break;
      
      case 'email.delivered':
        console.log('✅ Email livré:', event.data.email_id);
        break;
      
      case 'email.delivery_delayed':
        console.log('⏳ Livraison retardée:', event.data.email_id);
        break;
      
      case 'email.bounced':
        console.log('❌ Email rebondi:', event.data.email_id, event.data.reason);
        break;
      
      case 'email.complained':
        console.log('⚠️ Email marqué comme spam:', event.data.email_id);
        break;
      
      case 'email.opened':
        console.log('👁️ Email ouvert:', event.data.email_id);
        break;
      
      case 'email.clicked':
        console.log('🖱️ Lien cliqué:', event.data.email_id);
        break;
      
      default:
        console.log('📦 Événement non traité:', event.type);
    }

    return new Response(
      JSON.stringify({ received: true, event_type: event.type }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('❌ Erreur webhook Resend:', errorMessage);
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

