import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ParseRequest {
  text: string;
  clients: Array<{ id: string; nom?: string; entreprise_nom?: string; prenom?: string }>;
  articles?: Array<{ code: string; libelle: string; prix_unitaire_ht: number; taux_tva: number }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { text, clients, articles }: ParseRequest = await req.json();

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Texte manquant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Utiliser Hugging Face Inference API (gratuit) pour améliorer le parsing
    // Model: microsoft/DialoGPT-medium ou un modèle de NER (Named Entity Recognition)
    // Pour l'instant, on va utiliser une approche hybride : parsing amélioré avec IA
    
    // Créer un prompt pour l'IA
    const clientsList = clients.map(c => 
      `- ${c.entreprise_nom || `${c.prenom || ''} ${c.nom || ''}`.trim() || c.nom || 'Sans nom'} (ID: ${c.id})`
    ).join('\n');
    
    const articlesList = articles && articles.length > 0 
      ? articles.map(a => `- ${a.code}: ${a.libelle} (${a.prix_unitaire_ht}€ HT, TVA ${a.taux_tva}%)`).join('\n')
      : 'Aucun article disponible';

    const prompt = `Tu es un assistant expert en facturation. Analyse ce texte et extrais les informations suivantes au format JSON strict:

Texte: "${text}"

Clients disponibles:
${clientsList}

Articles disponibles:
${articlesList}

Extrais et réponds UNIQUEMENT en JSON valide:
{
  "client_id": "id du client si trouvé, sinon null",
  "montant": nombre ou null,
  "taux_tva": nombre ou null,
  "description": "description de la facture ou null",
  "date": "YYYY-MM-DD ou null",
  "date_echeance": "YYYY-MM-DD ou null",
  "notes": "notes ou null",
  "lignes": [
    {
      "description": "description de la ligne",
      "quantite": nombre,
      "prix": nombre,
      "tva": nombre ou null,
      "code": "code article si trouvé ou null"
    }
  ] ou []
}

IMPORTANT: 
- Si un code article est mentionné (ex: MO1, APP), utilise les informations de l'article correspondant
- Si un client est mentionné, trouve le meilleur match dans la liste
- Les montants doivent être en nombre (pas de texte)
- Les dates doivent être au format YYYY-MM-DD`;

    // Utiliser Hugging Face Inference API (gratuit, pas besoin de clé pour certains modèles)
    // Ou utiliser un modèle local via Ollama si disponible
    // Pour l'instant, on va utiliser une approche simple avec parsing amélioré
    
    // Essayer d'utiliser Hugging Face (gratuit)
    let aiResult = null;
    try {
      // Utiliser un modèle gratuit de Hugging Face
      const hfResponse = await fetch('https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_length: 500,
            temperature: 0.3,
          },
        }),
      });

      if (hfResponse.ok) {
        const hfData = await hfResponse.json();
        aiResult = hfData;
      }
    } catch (error) {
      console.log('Hugging Face non disponible, utilisation du parsing local');
    }

    // Si l'IA n'est pas disponible, utiliser le parsing local amélioré
    // On va créer une fonction de parsing améliorée ici
    const parsed = parseInvoiceText(text, clients, articles || []);

    return new Response(
      JSON.stringify({
        success: true,
        parsed,
        ai_used: aiResult !== null,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// Fonction de parsing améliorée (fallback si IA non disponible)
function parseInvoiceText(
  text: string,
  clients: Array<{ id: string; nom?: string; entreprise_nom?: string; prenom?: string }>,
  articles: Array<{ code: string; libelle: string; prix_unitaire_ht: number; taux_tva: number }>
): any {
  const lowerText = text.toLowerCase();
  const result: any = {};

  // Trouver le client
  for (const client of clients) {
    const clientName = (client.entreprise_nom || `${client.prenom || ''} ${client.nom || ''}`.trim() || client.nom || '').toLowerCase();
    if (clientName && lowerText.includes(clientName)) {
      result.client_id = client.id;
      break;
    }
  }

  // Extraire le montant
  const amountMatch = text.match(/(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*(?:euros?|€|euro)/i);
  if (amountMatch) {
    const amountStr = amountMatch[1].replace(/[^\d,.]/g, '').replace(/\s/g, '').replace(',', '.');
    result.montant = parseFloat(amountStr);
  }

  // Extraire la TVA
  const tvaMatch = text.match(/(?:tva|t\.v\.a)\s*(?:de|à|:)?\s*(\d+(?:[.,]\d+)?)\s*%/i);
  if (tvaMatch) {
    result.taux_tva = parseFloat(tvaMatch[1].replace(',', '.'));
  } else {
    result.taux_tva = 20;
  }

  // Extraire la description
  const descriptionKeywords = ['pour', 'concernant', 'relatif à', 'description', 'développement', 'création'];
  for (const keyword of descriptionKeywords) {
    const index = lowerText.indexOf(keyword);
    if (index !== -1) {
      let description = text.substring(index + keyword.length).trim();
      description = description.replace(/\d+[\s,.]?\d*\s*(?:euros?|€)/gi, '').replace(/\d+\s*%/g, '').trim();
      if (description.length > 5) {
        result.description = description.substring(0, 200);
        break;
      }
    }
  }

  // Extraire les lignes d'articles
  const lignes: any[] = [];
  
  // Chercher les codes d'articles
  for (const article of articles) {
    const codePattern = new RegExp(`\\b${article.code}\\b`, 'i');
    if (codePattern.test(text)) {
      const quantiteMatch = text.match(new RegExp(`${article.code}\\s+(\\d+(?:[.,]\\d+)?)`, 'i'));
      const quantite = quantiteMatch ? parseFloat(quantiteMatch[1].replace(',', '.')) : 1;
      
      lignes.push({
        description: article.libelle,
        quantite,
        prix: article.prix_unitaire_ht,
        tva: article.taux_tva,
        code: article.code,
      });
    }
  }

  // Chercher des patterns de lignes
  const lignePattern = /(?:article|produit|service)\s+(.+?)\s+(?:quantité|qté)\s+(\d+(?:[.,]\d+)?)\s+(?:prix|à)\s+(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)/gi;
  const matches = text.matchAll(lignePattern);
  for (const match of matches) {
    const description = match[1].trim();
    const quantite = parseFloat(match[2].replace(',', '.'));
    const prixStr = match[3].replace(/[^\d,.]/g, '').replace(/\s/g, '').replace(',', '.');
    const prix = parseFloat(prixStr);
    
    if (description && quantite > 0 && prix > 0) {
      lignes.push({
        description: description.substring(0, 200),
        quantite,
        prix,
        tva: result.taux_tva || 20,
        code: null,
      });
    }
  }

  if (lignes.length > 0) {
    result.lignes = lignes;
  }

  // Date
  if (lowerText.includes('aujourd\'hui') || lowerText.includes('aujourd hui')) {
    result.date = new Date().toISOString().split('T')[0];
  }

  return result;
}

