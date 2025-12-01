import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// APIs disponibles (gratuites pour le développement)
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY'); // Gratuit jusqu'à 15 req/min et 1500/jour

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

    const clientsList = clients.map(c => 
      `- ${c.entreprise_nom || `${c.prenom || ''} ${c.nom || ''}`.trim() || c.nom || 'Sans nom'} (ID: ${c.id})`
    ).join('\n');
    
    const articlesList = articles && articles.length > 0 
      ? articles.map(a => `- ${a.code}: ${a.libelle} (${a.prix_unitaire_ht}€ HT, TVA ${a.taux_tva}%)`).join('\n')
      : 'Aucun article disponible';

    const prompt = `Tu es un expert en facturation française. Analyse ce texte (qui peut être une transcription vocale TRÈS COURTE avec des erreurs) et extrais TOUTES les informations de facture.

TEXTE À ANALYSER (peut être très court, même 3-4 mots):
"${text}"

CLIENTS DISPONIBLES:
${clientsList}

ARTICLES DISPONIBLES:
${articlesList}

INSTRUCTIONS CRITIQUES:
1. Le texte peut être TRÈS COURT (3-4 mots seulement) - sois intelligent et déduis ce qui manque
2. Si un client est mentionné (même partiellement), trouve le meilleur match dans la liste (tolérance maximale aux erreurs)
3. CORRECTION IMPORTANTE : Les erreurs de transcription vocale sont fréquentes (ex: "cyrille" au lieu de "cyril", "marie" au lieu de "mari")
   - Utilise le fuzzy matching pour trouver le client même avec des erreurs de transcription
   - Compare chaque mot du texte avec chaque mot des noms de clients
   - Accepte les erreurs d'ajout/suppression de lettres à la fin des mots (ex: "cyrille" = "cyril")
4. Si un nombre est mentionné, c'est probablement un montant (même sans "euros" ou "€")
5. Si un code article est mentionné (ex: MO1, APP), utilise les informations de l'article correspondant
6. Détecte TOUS les articles mentionnés, même s'ils sont séparés par "puis", "ensuite", "et", "plus"
7. Pour les montants, accepte TOUS les formats: "2650", "2650 euros", "2650€", "2 650", "2,650", "2650" seul
8. Les quantités par défaut sont 1 si non spécifiées
9. La TVA par défaut est 20% si non spécifiée
10. Sois TRÈS tolérant avec les erreurs de transcription vocale (fautes de frappe, lettres manquantes/ajoutées)
11. Si le texte contient seulement "créer facture [nom client]", crée une facture pour ce client
12. Si le texte contient "[description] [montant]", crée une ligne d'article avec cette description et ce montant
13. Même avec 2-3 mots, essaie de trouver le client et/ou le montant

EXEMPLES:
- "créer facture groupe mclem" → client_id: id de "Groupe MCLEM", description: "Facture Groupe MCLEM"
- "rideaux métallique 2650" → lignes: [{description: "rideaux métallique", prix: 2650, quantite: 1}]
- "facture client 1500 euros" → montant: 1500

IMPORTANT: Réponds UNIQUEMENT en JSON valide, sans texte avant ou après, sans markdown, sans code blocks. Format exact:
{
  "client_id": "id du client si trouvé, sinon null",
  "montant": nombre ou null,
  "taux_tva": nombre ou null,
  "description": "description générale de la facture ou null",
  "date": "YYYY-MM-DD ou null",
  "date_echeance": "YYYY-MM-DD ou null",
  "notes": "notes ou null",
  "lignes": [
    {
      "description": "description de la ligne d'article",
      "quantite": nombre,
      "prix": nombre,
      "tva": nombre ou null,
      "code": "code article si trouvé ou null"
    }
  ]
}`;

    let aiParsed: any = null;
    let aiProvider = 'none';

    // 1. Essayer Google Gemini (GRATUIT pour développement)
    console.log('🔍 Vérification Gemini...');
    console.log('🔍 GEMINI_API_KEY présent:', GEMINI_API_KEY ? 'OUI' : 'NON');
    console.log('🔍 Longueur clé:', GEMINI_API_KEY ? GEMINI_API_KEY.length : 0);
    console.log('🔍 Préfixe clé:', GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 10) + '...' : 'N/A');
    console.log('🔍 Format clé valide:', GEMINI_API_KEY && GEMINI_API_KEY.startsWith('AIza') ? 'OUI (commence par AIza)' : GEMINI_API_KEY ? 'NON (ne commence pas par AIza)' : 'N/A');
    
    if (GEMINI_API_KEY) {
      // Tester plusieurs modèles et formats (gemini-pro est le plus stable)
      const geminiConfigs: Array<{url: string, headers: Record<string, string>, name: string}> = [
        // PRIORITÉ 1: gemini-pro (modèle le plus stable et disponible)
        {
          url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
          headers: { 'Content-Type': 'application/json' },
          name: 'v1beta/gemini-pro + key param'
        },
        // PRIORITÉ 2: gemini-pro avec header
        {
          url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent`,
          headers: { 
            'Content-Type': 'application/json',
            'x-goog-api-key': GEMINI_API_KEY
          },
          name: 'v1beta/gemini-pro + header'
        },
        // PRIORITÉ 3: gemini-1.5-flash (si disponible)
        {
          url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          headers: { 'Content-Type': 'application/json' },
          name: 'v1beta/gemini-1.5-flash + key param'
        },
        // PRIORITÉ 4: gemini-1.5-flash avec header
        {
          url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`,
          headers: { 
            'Content-Type': 'application/json',
            'x-goog-api-key': GEMINI_API_KEY
          },
          name: 'v1beta/gemini-1.5-flash + header'
        },
        // PRIORITÉ 5: gemini-2.5-flash (nouveau modèle)
        {
          url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          headers: { 'Content-Type': 'application/json' },
          name: 'v1beta/gemini-2.5-flash + key param'
        },
      ];
      
      let geminiSuccess = false;
      
      for (let i = 0; i < geminiConfigs.length && !geminiSuccess; i++) {
        const config = geminiConfigs[i];
        try {
          console.log(`🚀 Tentative ${i + 1}/${geminiConfigs.length} - ${config.name}`);
          console.log('🔗 URL Gemini:', config.url.replace(GEMINI_API_KEY, '***'));
          console.log('🔗 Headers:', JSON.stringify(config.headers).replace(GEMINI_API_KEY, '***'));
          
          // CORRECTION: Format de requête selon documentation officielle Gemini
          // Ne pas utiliser responseMimeType dans generationConfig (cause erreur 400)
          // On demande JSON dans le prompt à la place
          const requestBody = {
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 2000,
              // responseMimeType supprimé - cause erreur 400 "Invalid JSON payload"
            },
          };
          
          console.log('📤 Body de la requête:', JSON.stringify(requestBody).substring(0, 300));
          
          const geminiResponse = await fetch(config.url, {
            method: 'POST',
            headers: config.headers,
            body: JSON.stringify(requestBody),
          });

          console.log('📡 Réponse Gemini - Status:', geminiResponse.status);
          console.log('📡 Réponse Gemini - OK:', geminiResponse.ok);

          if (geminiResponse.ok) {
            const geminiData = await geminiResponse.json();
            console.log('📦 Données Gemini reçues:', JSON.stringify(geminiData).substring(0, 500));
            
            const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
            console.log('📝 Contenu extrait:', content ? content.substring(0, 200) : 'AUCUN');
            
            if (content) {
              try {
                // Nettoyer le JSON (enlever markdown si présent)
                const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                console.log('🧹 Contenu nettoyé:', cleanedContent.substring(0, 200));
                
                aiParsed = JSON.parse(cleanedContent);
                aiProvider = 'gemini';
                geminiSuccess = true;
                console.log(`✅ Parsing Gemini réussi (${config.name}):`, JSON.stringify(aiParsed).substring(0, 500));
                break; // Sortir de la boucle si succès
              } catch (parseError) {
                console.error('❌ Erreur parsing JSON Gemini:', parseError);
                console.log('📝 Contenu reçu (complet):', content);
              }
            } else {
              console.error('❌ Aucun contenu dans la réponse Gemini');
              console.log('📦 Structure complète:', JSON.stringify(geminiData, null, 2));
            }
          } else {
            const errorText = await geminiResponse.text();
            console.error(`❌ Tentative ${i + 1} (${config.name}) échouée - Status:`, geminiResponse.status);
            console.error('❌ Erreur API Gemini - Texte complet:', errorText);
            
            // Parser l'erreur pour plus de détails
            try {
              const errorJson = JSON.parse(errorText);
              console.error('❌ Erreur détaillée:', JSON.stringify(errorJson, null, 2));
              if (errorJson.error) {
                console.error('❌ Code erreur:', errorJson.error.code);
                console.error('❌ Message erreur:', errorJson.error.message);
                console.error('❌ Status erreur:', errorJson.error.status);
              }
            } catch (e) {
              // Pas de JSON, garder le texte brut
            }
            
            if (i < geminiConfigs.length - 1) {
              console.log('🔄 Essai du format suivant...');
            }
          }
        } catch (error) {
          console.error(`❌ Erreur tentative ${i + 1} (${config.name}):`, error);
          if (i < geminiConfigs.length - 1) {
            console.log('🔄 Essai du format suivant...');
          }
        }
      }
      
      if (!geminiSuccess) {
        console.error('❌ Toutes les tentatives Gemini ont échoué');
        console.error('💡 Vérifiez que la clé API est valide et a les bonnes permissions');
      }
    } else {
      console.log('⚠️ GEMINI_API_KEY non configurée, passage à OpenAI ou parsing local');
    }

    // 2. Si Gemini n'a pas fonctionné, essayer OpenAI (si clé disponible)
    if (!aiParsed && OPENAI_API_KEY) {
      try {
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
                content: 'Tu es un expert en facturation française. Tu analyses des textes (y compris des transcriptions vocales) pour extraire des informations de facture. Tu réponds toujours en JSON valide.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' },
            max_tokens: 2000,
          }),
        });

        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json();
          const content = openaiData.choices[0]?.message?.content;
          
          if (content) {
            try {
              aiParsed = JSON.parse(content);
              aiProvider = 'openai';
              console.log('✅ Parsing OpenAI réussi:', aiParsed);
            } catch (parseError) {
              console.error('❌ Erreur parsing JSON OpenAI:', parseError);
            }
          }
        }
      } catch (error) {
        console.error('❌ Erreur appel OpenAI:', error);
      }
    }

    // 3. Fallback: utiliser le parsing local amélioré (déjà très performant)
    const localParsed = parseInvoiceTextLocal(text, clients, articles || []);

    // Fusionner les résultats (IA en priorité, local en complément)
    const finalParsed: any = aiParsed || localParsed;
    
    // Si l'IA a trouvé des choses que le local n'a pas, les utiliser
    if (aiParsed && localParsed) {
      // Fusionner les lignes (éviter les doublons)
      if (aiParsed.lignes && aiParsed.lignes.length > 0) {
        finalParsed.lignes = aiParsed.lignes;
      } else if (localParsed.lignes && localParsed.lignes.length > 0) {
        finalParsed.lignes = localParsed.lignes;
      }
      
      // Utiliser le client de l'IA si trouvé
      if (aiParsed.client_id) {
        finalParsed.client_id = aiParsed.client_id;
      }
      
      // Utiliser les autres champs de l'IA s'ils sont meilleurs
      if (aiParsed.montant) finalParsed.montant = aiParsed.montant;
      if (aiParsed.taux_tva) finalParsed.taux_tva = aiParsed.taux_tva;
      if (aiParsed.description) finalParsed.description = aiParsed.description;
      if (aiParsed.date) finalParsed.date = aiParsed.date;
      if (aiParsed.date_echeance) finalParsed.date_echeance = aiParsed.date_echeance;
      if (aiParsed.notes) finalParsed.notes = aiParsed.notes;
    }

    return new Response(
      JSON.stringify({
        success: true,
        parsed: finalParsed,
        ai_used: aiParsed !== null,
        ai_provider: aiProvider,
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

// Fonction de parsing local améliorée (fallback - déjà très performant)
function parseInvoiceTextLocal(
  text: string,
  clients: Array<{ id: string; nom?: string; entreprise_nom?: string; prenom?: string }>,
  articles: Array<{ code: string; libelle: string; prix_unitaire_ht: number; taux_tva: number }>
): any {
  const lowerText = text.toLowerCase();
  const result: any = {};

  // Fonction de similarité simple (distance de Levenshtein simplifiée)
  const simpleSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    
    // Distance de Levenshtein simplifiée
    let distance = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer[i] !== shorter[i]) distance++;
    }
    distance += longer.length - shorter.length;
    
    return (longer.length - distance) / longer.length;
  };

  // Trouver le client (AMÉLIORÉ pour fonctionner avec peu de mots et corriger les erreurs de transcription)
  let bestClientMatch: { id: string; name: string; score: number } | null = null;
  
  for (const client of clients) {
    const clientName = (client.entreprise_nom || `${client.prenom || ''} ${client.nom || ''}`.trim() || client.nom || '').toLowerCase();
    if (!clientName) continue;
    
    // Recherche exacte
    if (lowerText.includes(clientName) || clientName.includes(lowerText)) {
      result.client_id = client.id;
      break;
    }
    
    // Recherche par mots (accepte les mots de 2+ caractères)
    const clientWords = clientName.split(/\s+/);
    const textWords = lowerText.split(/\s+/);
    
    for (const clientWord of clientWords) {
      if (clientWord.length >= 2) {
        for (const textWord of textWords) {
          if (textWord.length >= 2) {
            // Correspondance exacte ou partielle
            if (textWord.includes(clientWord) || clientWord.includes(textWord)) {
              result.client_id = client.id;
              break;
            }
            
            // NOUVEAU : Correction des erreurs de transcription (ex: "cyrille" → "cyril")
            const wordSim = simpleSimilarity(textWord, clientWord);
            // Pour les mots courts (<= 7 caractères), accepter une similarité de 0.75
            // Pour les mots plus longs, garder 0.85
            const threshold = clientWord.length <= 7 ? 0.75 : 0.85;
            if (wordSim >= threshold) {
              console.log(`✅ Match trouvé par similarité: "${textWord}" ≈ "${clientWord}" (${(wordSim * 100).toFixed(1)}%)`);
              result.client_id = client.id;
              break;
            }
          }
        }
        if (result.client_id) break;
      }
    }
    
    if (result.client_id) break;
    
    // Fuzzy matching global pour les cas difficiles
    const globalSim = simpleSimilarity(lowerText, clientName);
    if (globalSim >= 0.7 && (!bestClientMatch || globalSim > bestClientMatch.score)) {
      bestClientMatch = { id: client.id, name: clientName, score: globalSim };
    }
  }
  
  // Si aucun match exact, utiliser le meilleur match fuzzy
  if (!result.client_id && bestClientMatch) {
    console.log(`✅ Client trouvé par fuzzy matching: "${bestClientMatch.name}" (score: ${(bestClientMatch.score * 100).toFixed(1)}%)`);
    result.client_id = bestClientMatch.id;
  }

  // Extraire le montant (AMÉLIORÉ pour fonctionner avec peu de mots)
  const amountMatch = text.match(/(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*(?:euros?|€|euro)/i);
  if (amountMatch) {
    const amountStr = amountMatch[1].replace(/[^\d,.]/g, '').replace(/\s/g, '').replace(',', '.');
    result.montant = parseFloat(amountStr);
  } else {
    // Si pas de montant avec "euros", chercher n'importe quel nombre (peut être un montant)
    const numberMatch = text.match(/\b(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)\b/);
    if (numberMatch) {
      const amountStr = numberMatch[1].replace(/[^\d,.]/g, '').replace(/\s/g, '').replace(',', '.');
      const num = parseFloat(amountStr);
      if (num && num >= 10) {
        result.montant = num;
      }
    }
  }

  // Extraire la TVA
  const tvaMatch = text.match(/(?:tva|t\.v\.a)\s*(?:de|à|:)?\s*(\d+(?:[.,]\d+)?)\s*%/i);
  if (tvaMatch) {
    result.taux_tva = parseFloat(tvaMatch[1].replace(',', '.'));
  } else {
    result.taux_tva = 20;
  }

  // Extraire la description (AMÉLIORÉ pour fonctionner avec peu de mots)
  const descriptionKeywords = ['pour', 'concernant', 'relatif à', 'description', 'développement', 'création', 'facture'];
  for (const keyword of descriptionKeywords) {
    const index = lowerText.indexOf(keyword);
    if (index !== -1) {
      let description = text.substring(index + keyword.length).trim();
      description = description.replace(/\d+[\s,.]?\d*\s*(?:euros?|€)/gi, '').replace(/\d+\s*%/g, '').trim();
      if (description.length > 2) {
        result.description = description.substring(0, 200);
        break;
      }
    }
  }
  
  // Si toujours pas de description, prendre les premiers mots (sauf les mots-clés)
  if (!result.description || result.description.length < 3) {
    const words = text.split(/\s+/).filter(w => {
      const lower = w.toLowerCase();
      return !['facture', 'pour', 'client', 'montant', 'total', 'prix', 'tva', 'euros', 'euro', '€', 'créer', 'créé'].includes(lower) && 
             lower.length > 2 && 
             !/^\d+$/.test(lower);
    });
    if (words.length > 0) {
      result.description = words.slice(0, 10).join(' ').substring(0, 200);
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
