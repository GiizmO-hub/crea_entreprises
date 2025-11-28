import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const buildCorsHeaders = (origin?: string) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, Stripe-Signature',
});

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

if (!stripeSecretKey || !stripeWebhookSecret) {
  console.error('Stripe secrets are not configured (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET)');
}

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' })
  : null;

type StripeCheckoutSession = Stripe.Checkout.Session;
type StripeSubscription = Stripe.Subscription;
type StripeInvoice = Stripe.Invoice;

serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('Origin') ?? undefined);

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    if (!stripe || !stripeWebhookSecret) {
      console.error('Stripe client non configuré');
      return new Response(
        JSON.stringify({ error: 'Configuration Stripe manquante' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Signature Stripe absente' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
    } catch (err) {
      console.error('Signature Stripe invalide', err);
      return new Response(
        JSON.stringify({ error: 'Signature Stripe invalide' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔔 [WEBHOOK] Stripe webhook received:', event.type);

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(supabaseClient, event.data.object as StripeCheckoutSession);
        break;

      case 'payment_intent.succeeded':
        // ✅ DÉSACTIVÉ : peut créer des doublons avec checkout.session.completed
        console.log('⚠️ [WEBHOOK] payment_intent.succeeded reçu mais désactivé pour éviter doublons');
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

    return new Response(
      JSON.stringify({ received: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('❌ [WEBHOOK] Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erreur inconnue' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// ✅ AMÉLIORATION : Vérifier le statut réel auprès de Stripe avant de valider
async function handleCheckoutCompleted(supabase: SupabaseClient, session: StripeCheckoutSession) {
  const { client_reference_id, metadata, payment_intent, id: session_id, payment_status } = session;
  
  console.log('🔔 [WEBHOOK] Checkout completed:', {
    session_id,
    client_reference_id,
    metadata,
    payment_intent: payment_intent || 'N/A',
    payment_status
  });

  // ✅ VÉRIFICATION CRITIQUE : Vérifier que le paiement est vraiment payé
  if (payment_status !== 'paid') {
    console.warn(`⚠️ [WEBHOOK] Session ${session_id} n'est pas payée (statut: ${payment_status}), ignorée`);
    return;
  }

  // ✅ VÉRIFICATION CRITIQUE : Récupérer les détails de la session depuis Stripe pour confirmation
  let sessionDetails: Stripe.Checkout.Session | null = null;
  try {
    sessionDetails = await stripe!.checkout.sessions.retrieve(session_id, {
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
  // ✅ DÉSACTIVÉ : Peut créer des doublons avec checkout.session.completed
  console.log('⚠️ [WEBHOOK] payment_intent.succeeded reçu mais désactivé pour éviter doublons');
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

