import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

interface EntrepriseInfo {
  nom: string;
  forme_juridique?: string;
  siret?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  email?: string;
  telephone?: string;
  site_web?: string;
}

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { entreprise_id } = await req.json();

    if (!entreprise_id) {
      return new Response(
        JSON.stringify({ error: 'entreprise_id est requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer les informations de l'entreprise depuis Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      const missing = [];
      if (!supabaseUrl) missing.push('SUPABASE_URL');
      if (!supabaseKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
      
      return new Response(
        JSON.stringify({ 
          error: `Missing required environment variables: ${missing.join(', ')}`,
          hint: 'Configure these secrets in Supabase Dashboard → Edge Functions → Secrets'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: entreprise, error: entrepriseError } = await supabase
      .from('entreprises')
      .select('nom, forme_juridique, siret, adresse, code_postal, ville, email, telephone, site_web')
      .eq('id', entreprise_id)
      .single();

    if (entrepriseError || !entreprise) {
      console.error('❌ Erreur récupération entreprise:', entrepriseError);
      return new Response(
        JSON.stringify({ error: 'Entreprise non trouvée' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const entrepriseInfo: EntrepriseInfo = entreprise;

    // Générer les mentions légales avec IA
    let generatedMentions: {
      footer_text: string;
      capital_social: string;
      rcs: string;
      tva_intracommunautaire: string;
    };

    // Essayer Gemini d'abord, puis OpenAI, puis fallback
    if (GEMINI_API_KEY) {
      try {
        generatedMentions = await generateWithGemini(entrepriseInfo);
        console.log('✅ Mentions générées avec Gemini');
      } catch (error) {
        console.error('❌ Erreur Gemini:', error);
        if (OPENAI_API_KEY) {
          try {
            generatedMentions = await generateWithOpenAI(entrepriseInfo);
            console.log('✅ Mentions générées avec OpenAI');
          } catch (error2) {
            console.error('❌ Erreur OpenAI:', error2);
            generatedMentions = generateDefaultMentions(entrepriseInfo);
            console.log('✅ Mentions générées par défaut');
          }
        } else {
          generatedMentions = generateDefaultMentions(entrepriseInfo);
          console.log('✅ Mentions générées par défaut');
        }
      }
    } else if (OPENAI_API_KEY) {
      try {
        generatedMentions = await generateWithOpenAI(entrepriseInfo);
        console.log('✅ Mentions générées avec OpenAI');
      } catch (error) {
        console.error('❌ Erreur OpenAI:', error);
        generatedMentions = generateDefaultMentions(entrepriseInfo);
        console.log('✅ Mentions générées par défaut');
      }
    } else {
      generatedMentions = generateDefaultMentions(entrepriseInfo);
      console.log('✅ Mentions générées par défaut');
    }

    return new Response(
      JSON.stringify({
        success: true,
        mentions: generatedMentions,
        ai_provider: GEMINI_API_KEY ? 'gemini' : OPENAI_API_KEY ? 'openai' : 'default',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erreur inconnue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateWithGemini(entreprise: EntrepriseInfo) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY non configuré');

  const prompt = `Tu es un expert juridique français spécialisé dans la rédaction de mentions légales pour les entreprises.

Informations de l'entreprise:
- Nom: ${entreprise.nom}
- Forme juridique: ${entreprise.forme_juridique || 'Non spécifiée'}
- SIRET: ${entreprise.siret || 'Non spécifié'}
- Adresse: ${entreprise.adresse || ''} ${entreprise.code_postal || ''} ${entreprise.ville || ''}
- Email: ${entreprise.email || 'Non spécifié'}
- Téléphone: ${entreprise.telephone || 'Non spécifié'}
- Site web: ${entreprise.site_web || 'Non spécifié'}

Génère des mentions légales complètes et conformes à la législation française pour cette entreprise.

Réponds UNIQUEMENT avec un JSON valide au format suivant (sans markdown, sans code block, juste le JSON brut):
{
  "footer_text": "Texte complet des mentions légales à afficher en bas de page (incluant toutes les informations légales obligatoires)",
  "capital_social": "Montant du capital social (ex: '10 000 €' ou 'Non spécifié' si inconnu)",
  "rcs": "Numéro RCS complet (ex: 'RCS Paris B 123 456 789' ou 'Non spécifié' si inconnu)",
  "tva_intracommunautaire": "Numéro TVA intracommunautaire (ex: 'FR12 345678901' ou 'Non spécifié' si inconnu)"
}

IMPORTANT:
- Le footer_text doit être complet et professionnel
- Si une information n'est pas disponible, utilise "Non spécifié" ou déduis-la si possible
- Le format doit être conforme à la législation française
- Utilise un ton professionnel et formel`;

  // Essayer différentes configurations Gemini
  const geminiConfigs = [
    {
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      headers: { 'Content-Type': 'application/json' },
    },
    {
      url: `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      headers: { 'Content-Type': 'application/json' },
    },
    {
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      headers: { 'Content-Type': 'application/json' },
    },
  ];

  for (const config of geminiConfigs) {
    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: config.headers,
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }],
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erreur Gemini (${config.url}):`, response.status, errorText);
        continue;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        console.error('❌ Réponse Gemini vide');
        continue;
      }

      // Extraire le JSON de la réponse
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Aucun JSON trouvé dans la réponse');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        footer_text: parsed.footer_text || '',
        capital_social: parsed.capital_social || '',
        rcs: parsed.rcs || '',
        tva_intracommunautaire: parsed.tva_intracommunautaire || '',
      };
    } catch (error) {
      console.error(`❌ Erreur avec config Gemini:`, error);
      continue;
    }
  }

  throw new Error('Toutes les configurations Gemini ont échoué');
}

async function generateWithOpenAI(entreprise: EntrepriseInfo) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY non configuré');

  const prompt = `Tu es un expert juridique français spécialisé dans la rédaction de mentions légales pour les entreprises.

Informations de l'entreprise:
- Nom: ${entreprise.nom}
- Forme juridique: ${entreprise.forme_juridique || 'Non spécifiée'}
- SIRET: ${entreprise.siret || 'Non spécifié'}
- Adresse: ${entreprise.adresse || ''} ${entreprise.code_postal || ''} ${entreprise.ville || ''}
- Email: ${entreprise.email || 'Non spécifié'}
- Téléphone: ${entreprise.telephone || 'Non spécifié'}
- Site web: ${entreprise.site_web || 'Non spécifié'}

Génère des mentions légales complètes et conformes à la législation française pour cette entreprise.

Réponds UNIQUEMENT avec un JSON valide au format suivant:
{
  "footer_text": "Texte complet des mentions légales à afficher en bas de page",
  "capital_social": "Montant du capital social (ex: '10 000 €')",
  "rcs": "Numéro RCS complet (ex: 'RCS Paris B 123 456 789')",
  "tva_intracommunautaire": "Numéro TVA intracommunautaire (ex: 'FR12 345678901')"
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
        { role: 'system', content: 'Tu es un expert juridique français. Réponds toujours en JSON valide.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error('Réponse OpenAI vide');
  }

  // Extraire le JSON de la réponse
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Aucun JSON trouvé dans la réponse');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    footer_text: parsed.footer_text || '',
    capital_social: parsed.capital_social || '',
    rcs: parsed.rcs || '',
    tva_intracommunautaire: parsed.tva_intracommunautaire || '',
  };
}

function generateDefaultMentions(entreprise: EntrepriseInfo): {
  footer_text: string;
  capital_social: string;
  rcs: string;
  tva_intracommunautaire: string;
} {
  const adresseComplete = [
    entreprise.adresse,
    entreprise.code_postal,
    entreprise.ville,
  ].filter(Boolean).join(', ');

  const footerText = [
    entreprise.nom,
    adresseComplete && `Siège social: ${adresseComplete}`,
    entreprise.siret && `SIRET: ${entreprise.siret}`,
    entreprise.telephone && `Tél: ${entreprise.telephone}`,
    entreprise.email && `Email: ${entreprise.email}`,
    entreprise.site_web && `Site web: ${entreprise.site_web}`,
  ].filter(Boolean).join(' | ');

  return {
    footer_text: footerText || 'Mentions légales à compléter',
    capital_social: 'Non spécifié',
    rcs: 'Non spécifié',
    tva_intracommunautaire: 'Non spécifié',
  };
}

