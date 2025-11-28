import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';

// ✅ CORRECTION : Headers CORS pour webhook Stripe (pas d'auth Supabase requise)
const buildCorsHeaders = (origin?: string) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, Stripe-Signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
});

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

if (!stripeSecretKey || !stripeWebhookSecret) {
  console.error('Stripe secrets are not configured (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET)');
}

// ✅ Créer le cryptoProvider pour Deno
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { 
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    })
  : null;

type StripeCheckoutSession = Stripe.Checkout.Session;
type StripeSubscription = Stripe.Subscription;
type StripeInvoice = Stripe.Invoice;

serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('Origin') ?? undefined);

  // ✅ Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // ✅ IMPORTANT : Les webhooks Stripe n'ont PAS besoin d'authentification Supabase
  // La vérification se fait via la signature Stripe uniquement

  try {
    // ✅ LIRE LE BODY AVANT TOUT (important pour la vérification de signature)
    const body = await req.text();
    
    // ✅ Récupérer la signature Stripe
    const signature = req.headers.get('stripe-signature') || 
                     req.headers.get('Stripe-Signature') ||
                     req.headers.get('STRIPE-SIGNATURE');

    // ✅ Logs de débogage
    console.log('🔍 [WEBHOOK] Headers reçus:', {
      method: req.method,
      has_stripe_signature: !!signature,
      content_type: req.headers.get('content-type'),
      body_length: body.length
    });

    if (!stripe || !stripeWebhookSecret) {
      console.error('❌ [WEBHOOK] Stripe client non configuré', {
        has_stripe: !!stripe,
        has_webhook_secret: !!stripeWebhookSecret
      });
      return new Response(
        JSON.stringify({ error: 'Configuration Stripe manquante' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ VÉRIFICATION CRITIQUE : La signature Stripe est OBLIGATOIRE
    if (!signature) {
      console.error('❌ [WEBHOOK] Signature Stripe absente', {
        headers: Array.from(req.headers.keys()),
        body_length: body.length
      });
      return new Response(
        JSON.stringify({ error: 'Signature Stripe absente' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('✅ [WEBHOOK] Signature Stripe trouvée, longueur:', signature.length);

    // ✅ Vérifier la signature Stripe avec méthode officielle Stripe pour Deno
    let event: Stripe.Event;
    try {
      console.log('🔍 [WEBHOOK] Vérification de la signature avec constructEventAsync...', {
        body_length: body.length,
        signature_length: signature.length,
        webhook_secret_length: stripeWebhookSecret?.length || 0
      });
      
      // ✅ Utiliser la méthode officielle Stripe pour Deno
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        stripeWebhookSecret,
        undefined, // tolerance (défaut 300 secondes)
        cryptoProvider
      );
      
      console.log('✅ [WEBHOOK] Signature Stripe validée, event type:', event.type, 'event id:', event.id);
    } catch (err) {
      console.error('❌ [WEBHOOK] Signature Stripe invalide:', {
        error: err instanceof Error ? err.message : String(err),
        error_stack: err instanceof Error ? err.stack : undefined,
        body_preview: body.substring(0, 200),
        signature_preview: signature.substring(0, 50)
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Signature Stripe invalide',
          details: err instanceof Error ? err.message : String(err)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ Créer le client Supabase avec Service Role Key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔔 [WEBHOOK] Stripe webhook received:', event.type);

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(supabaseClient, event.data.object as StripeCheckoutSession);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(supabaseClient, event.data.object as StripeSubscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(supabaseClient, event.data.object as StripeSubscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(supabaseClient, event.data.object as StripeSubscription);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(supabaseClient, event.data.object as StripeInvoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(supabaseClient, event.data.object as StripeInvoice);
        break;

      default:
        console.log(`⚠️ [WEBHOOK] Event type non géré: ${event.type}`);
    }

    // ✅ Retourner 200 OK pour indiquer à Stripe que le webhook a été traité
    return new Response(
      JSON.stringify({ received: true, event_type: event.type, event_id: event.id }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('❌ [WEBHOOK] Webhook error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        received: false 
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// ✅ CORRECTION : Vérifier le statut réel auprès de Stripe avant de valider
async function handleCheckoutCompleted(supabase: SupabaseClient, session: StripeCheckoutSession) {
  const { client_reference_id, metadata, payment_intent, id: session_id, payment_status } = session;
  
  console.log('🔔 [WEBHOOK] Checkout completed:', {
    session_id,
    client_reference_id,
    metadata,
    payment_intent: payment_intent || 'N/A',
    payment_status
  });

  // ✅ VÉRIFICATION CRITIQUE 1 : Vérifier que le paiement est vraiment payé
  if (payment_status !== 'paid') {
    console.warn(`⚠️ [WEBHOOK] Session ${session_id} n'est pas payée (statut: ${payment_status}), ignorée`);
    return;
  }

  // ✅ VÉRIFICATION CRITIQUE 2 : Récupérer les détails de la session depuis Stripe pour confirmation
  let sessionDetails: Stripe.Checkout.Session | null = null;
  try {
    if (!stripe) {
      console.error('❌ [WEBHOOK] Stripe client non initialisé');
      return;
    }
    
    sessionDetails = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['payment_intent']
    });
    
    console.log('📋 [WEBHOOK] Détails session Stripe récupérés:', {
      id: sessionDetails.id,
      payment_status: sessionDetails.payment_status,
      payment_intent: sessionDetails.payment_intent
    });
    
    // Double vérification du statut
    if (sessionDetails.payment_status !== 'paid') {
      console.warn(`⚠️ [WEBHOOK] Session ${session_id} confirmée comme non payée par Stripe API (${sessionDetails.payment_status})`);
      return;
    }
  } catch (error) {
    console.error('❌ [WEBHOOK] Erreur récupération session depuis Stripe:', error);
    // Continuer quand même si on peut récupérer le paiement_id
  }

  // client_reference_id devrait contenir le paiement_id
  const paiementId = client_reference_id || metadata?.paiement_id;
  
  if (!paiementId) {
    console.error('❌ [WEBHOOK] Missing paiement_id in client_reference_id and metadata');
    console.error('   client_reference_id:', client_reference_id);
    console.error('   metadata:', JSON.stringify(metadata, null, 2));
    return;
  }

  console.log('📋 [WEBHOOK] Paiement ID trouvé:', paiementId);
  
  // ✅ Récupérer le payment_intent_id pour le stocker dans stripe_payment_id
  const stripePaymentId = sessionDetails?.payment_intent?.id || 
                          (typeof sessionDetails?.payment_intent === 'string' ? sessionDetails.payment_intent : null) ||
                          payment_intent || 
                          session_id; // Fallback sur session_id si pas de payment_intent
  
  console.log('📋 [WEBHOOK] Stripe Payment ID déterminé:', stripePaymentId);
  console.log('📋 [WEBHOOK] Appel de valider_paiement_carte_immediat avec stripe_payment_id...');

  // ✅ Valider le paiement avec le stripe_payment_id (confirmation Stripe)
  const { data, error } = await supabase.rpc('valider_paiement_carte_immediat', {
    p_paiement_id: paiementId,
    p_stripe_payment_id: stripePaymentId
  });

  if (error) {
    console.error('❌ [WEBHOOK] Error validating payment:', error);
    console.error('   Error code:', error.code);
    console.error('   Error message:', error.message);
    console.error('   Error details:', error.details);
    console.error('   Error hint:', error.hint);
  } else {
    console.log('✅ [WEBHOOK] Payment validated successfully');
    console.log('   Response:', JSON.stringify(data, null, 2));
    
    // Vérifier le résultat
    if (data && data.success) {
      console.log('✅ [WEBHOOK] Workflow complet réussi:');
      console.log('   - Facture ID:', data.facture_id);
      console.log('   - Abonnement ID:', data.abonnement_id);
      console.log('   - Espace membre ID:', data.espace_membre_id);
    } else {
      console.warn('⚠️ [WEBHOOK] Workflow partiel ou erreur:', data);
    }
  }
}

async function handlePaymentIntentSucceeded(supabase: SupabaseClient, paymentIntent: Stripe.PaymentIntent) {
  // ✅ DÉSACTIVÉ pour éviter les doublons
  console.log('⚠️ [WEBHOOK] payment_intent.succeeded reçu mais désactivé (géré par checkout.session.completed)');
}

async function handleSubscriptionCreated(_supabase: SupabaseClient, subscription: StripeSubscription) {
  console.log('📦 [WEBHOOK] Subscription created:', subscription.id);
}

async function handleSubscriptionUpdated(_supabase: SupabaseClient, subscription: StripeSubscription) {
  console.log('📦 [WEBHOOK] Subscription updated:', subscription.id);
  const status = subscription.status;
  if (status === 'canceled' || status === 'unpaid') {
    console.log('⚠️ [WEBHOOK] Subscription canceled or unpaid:', subscription.id);
  }
}

async function handleSubscriptionDeleted(_supabase: SupabaseClient, subscription: StripeSubscription) {
  console.log('📦 [WEBHOOK] Subscription deleted:', subscription.id);
}

async function handleInvoicePaid(_supabase: SupabaseClient, invoice: StripeInvoice) {
  console.log('📄 [WEBHOOK] Invoice paid:', invoice.id);
}

async function handlePaymentFailed(_supabase: SupabaseClient, invoice: StripeInvoice) {
  console.log('❌ [WEBHOOK] Payment failed for invoice:', invoice.id);
}
