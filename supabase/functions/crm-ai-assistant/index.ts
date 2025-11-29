// Edge Function pour l'assistant IA du CRM
// Fonctionnalités : génération d'emails, analyse prédictive, suggestions, analyse de sentiment

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

interface AIRequest {
  action: 'generate_email' | 'analyze_opportunity' | 'suggest_actions' | 'analyze_sentiment' | 'generate_proposal';
  data: any;
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Vérifier l'authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Vérifier l'utilisateur
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { action, data }: AIRequest = await req.json();

    let result;

    switch (action) {
      case 'generate_email':
        result = await generateEmail(data, supabase);
        break;
      case 'analyze_opportunity':
        result = await analyzeOpportunity(data, supabase);
        break;
      case 'suggest_actions':
        result = await suggestActions(data, supabase);
        break;
      case 'analyze_sentiment':
        result = await analyzeSentiment(data);
        break;
      case 'generate_proposal':
        result = await generateProposal(data, supabase);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});

// 1. Génération d'email commercial personnalisé
async function generateEmail(data: any, supabase: any) {
  const { client_id, type, context, entreprise_id } = data;

  // Récupérer les infos du client
  let clientInfo = '';
  if (client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select('nom, prenom, entreprise_nom, email, telephone')
      .eq('id', client_id)
      .single();
    
    if (client) {
      clientInfo = `Client: ${client.nom} ${client.prenom || ''} ${client.entreprise_nom || ''}, Email: ${client.email || 'N/A'}`;
    }
  }

  // Récupérer les infos de l'entreprise
  let entrepriseInfo = '';
  if (entreprise_id) {
    const { data: entreprise } = await supabase
      .from('entreprises')
      .select('nom, email, telephone, site_web')
      .eq('id', entreprise_id)
      .single();
    
    if (entreprise) {
      entrepriseInfo = `Entreprise: ${entreprise.nom}, Site web: ${entreprise.site_web || 'N/A'}`;
    }
  }

  const prompt = `Tu es un assistant commercial expert. Génère un email professionnel en français pour ${type || 'un client'}.

${clientInfo}
${entrepriseInfo}
${context ? `Contexte: ${context}` : ''}

Génère un email:
- Professionnel et personnalisé
- Avec un objet accrocheur
- Avec un ton adapté au contexte
- Avec un appel à l'action clair
- En français

Réponds au format JSON:
{
  "objet": "Objet de l'email",
  "contenu": "Contenu HTML de l'email",
  "contenu_texte": "Version texte de l'email"
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en communication commerciale. Tu génères des emails professionnels en français.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  const aiResponse = await response.json();
  const content = JSON.parse(aiResponse.choices[0].message.content);

  return {
    success: true,
    objet: content.objet,
    contenu: content.contenu,
    contenu_texte: content.contenu_texte,
  };
}

// 2. Analyse prédictive d'opportunité
async function analyzeOpportunity(data: any, supabase: any) {
  const { opportunite_id, entreprise_id } = data;

  // Récupérer l'opportunité et son historique
  const { data: opportunite } = await supabase
    .from('crm_opportunites')
    .select(`
      *,
      client:clients(*),
      etape:crm_pipeline_etapes(*)
    `)
    .eq('id', opportunite_id)
    .single();

  if (!opportunite) {
    throw new Error('Opportunité non trouvée');
  }

  // Récupérer les activités liées
  const { data: activites } = await supabase
    .from('crm_activites')
    .select('*')
    .eq('opportunite_id', opportunite_id)
    .order('date_activite', { ascending: false })
    .limit(10);

  // Récupérer les statistiques du pipeline
  const { data: stats } = await supabase.rpc('get_crm_pipeline_stats', {
    p_entreprise_id: entreprise_id,
  });

  const prompt = `Analyse cette opportunité commerciale et prédits sa probabilité de succès:

Opportunité: ${opportunite.nom}
Montant: ${opportunite.montant_estime} ${opportunite.devise}
Étape actuelle: ${opportunite.etape?.nom || 'N/A'}
Probabilité actuelle: ${opportunite.probabilite}%
Date de fermeture prévue: ${opportunite.date_fermeture_prevue || 'N/A'}
Client: ${opportunite.client?.nom || 'N/A'}

Activités récentes: ${activites?.length || 0} activités
Statistiques pipeline: Taux de réussite ${stats?.taux_reussite || 0}%

Analyse et réponds en JSON:
{
  "probabilite_predite": nombre entre 0 et 100,
  "risques": ["risque1", "risque2"],
  "recommandations": ["reco1", "reco2"],
  "prochaines_actions": ["action1", "action2"],
  "analyse": "Analyse détaillée en français"
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en analyse commerciale et prédiction de ventes.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  const aiResponse = await response.json();
  const analysis = JSON.parse(aiResponse.choices[0].message.content);

  return {
    success: true,
    ...analysis,
  };
}

// 3. Suggestions d'actions
async function suggestActions(data: any, supabase: any) {
  const { opportunite_id, client_id, entreprise_id } = data;

  let context = '';

  if (opportunite_id) {
    const { data: opp } = await supabase
      .from('crm_opportunites')
      .select('*, client:clients(*), etape:crm_pipeline_etapes(*)')
      .eq('id', opportunite_id)
      .single();
    
    if (opp) {
      context = `Opportunité: ${opp.nom}, Montant: ${opp.montant_estime}, Étape: ${opp.etape?.nom || 'N/A'}`;
    }
  }

  if (client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .single();
    
    if (client) {
      context += ` Client: ${client.nom} ${client.prenom || ''}`;
    }
  }

  // Récupérer les activités récentes
  const { data: activites } = await supabase
    .from('crm_activites')
    .select('*')
    .eq('entreprise_id', entreprise_id)
    .order('date_activite', { ascending: false })
    .limit(5);

  const prompt = `Suggère 5 prochaines actions commerciales prioritaires basées sur ce contexte:

${context}
Activités récentes: ${activites?.map(a => `${a.type_activite}: ${a.sujet}`).join(', ') || 'Aucune'}

Réponds en JSON:
{
  "actions": [
    {
      "type": "appel|email|reunion|tache",
      "titre": "Titre de l'action",
      "description": "Description détaillée",
      "priorite": "basse|normale|haute|urgente",
      "delai_jours": nombre de jours recommandé
    }
  ]
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en stratégie commerciale. Tu suggères des actions concrètes et prioritaires.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  const aiResponse = await response.json();
  const suggestions = JSON.parse(aiResponse.choices[0].message.content);

  return {
    success: true,
    ...suggestions,
  };
}

// 4. Analyse de sentiment
async function analyzeSentiment(data: any) {
  const { texte } = data;

  if (!texte) {
    throw new Error('Texte manquant');
  }

  const prompt = `Analyse le sentiment de ce texte commercial (email, note, commentaire):

"${texte}"

Réponds en JSON:
{
  "sentiment": "positif|negatif|neutre",
  "score": nombre entre -1 et 1,
  "emotions": ["emotion1", "emotion2"],
  "alertes": ["alerte1 si négatif"],
  "analyse": "Analyse détaillée en français"
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en analyse de sentiment et communication.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  const aiResponse = await response.json();
  const analysis = JSON.parse(aiResponse.choices[0].message.content);

  return {
    success: true,
    ...analysis,
  };
}

// 5. Génération de proposition commerciale
async function generateProposal(data: any, supabase: any) {
  const { opportunite_id, entreprise_id } = data;

  const { data: opportunite } = await supabase
    .from('crm_opportunites')
    .select('*, client:clients(*)')
    .eq('id', opportunite_id)
    .single();

  if (!opportunite) {
    throw new Error('Opportunité non trouvée');
  }

  const { data: entreprise } = await supabase
    .from('entreprises')
    .select('*')
    .eq('id', entreprise_id)
    .single();

  const prompt = `Génère une proposition commerciale professionnelle en français:

Client: ${opportunite.client?.nom || 'N/A'}
Opportunité: ${opportunite.nom}
Montant: ${opportunite.montant_estime} ${opportunite.devise}
Description: ${opportunite.description || 'N/A'}

Entreprise: ${entreprise?.nom || 'N/A'}

Génère une proposition complète avec:
- Introduction personnalisée
- Présentation de la solution
- Avantages et bénéfices
- Tarification
- Prochaines étapes
- Appel à l'action

Réponds en JSON:
{
  "titre": "Titre de la proposition",
  "introduction": "Introduction personnalisée",
  "solution": "Description de la solution",
  "avantages": ["avantage1", "avantage2"],
  "tarification": "Détails tarifaires",
  "prochaines_etapes": ["étape1", "étape2"],
  "conclusion": "Conclusion avec appel à l'action"
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en rédaction de propositions commerciales professionnelles.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  const aiResponse = await response.json();
  const proposal = JSON.parse(aiResponse.choices[0].message.content);

  return {
    success: true,
    ...proposal,
  };
}

