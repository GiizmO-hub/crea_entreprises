/**
 * Parse le texte vocal pour extraire les informations de facture
 * VERSION AMÉLIORÉE - Parsing intelligent et structuré
 */

export interface ParsedInvoiceData {
  client?: string;
  montant?: number;
  description?: string;
  date?: string;
  date_echeance?: string;
  taux_tva?: number;
  notes?: string;
  lignes?: Array<{
    description: string;
    quantite: number;
    prix: number;
    tva?: number;
    code?: string;
  }>;
}

/**
 * Fonction pour calculer la similarité entre deux chaînes (fuzzy matching)
 */
function similarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  if (longer.length === 0) return 1.0;
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Distance de Levenshtein pour le fuzzy matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

/**
 * Nettoie et normalise un nombre
 */
function parseNumber(str: string): number | null {
  if (!str) return null;
  const cleaned = str.replace(/[^\d,.]/g, '').replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) || num <= 0 ? null : num;
}

/**
 * Extrait tous les montants du texte (AMÉLIORÉ pour fonctionner avec peu de mots)
 */
function extractAmounts(text: string): number[] {
  const amounts: number[] = [];
  const patterns = [
    /(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*(?:euros?|€|euro|eur)/gi,
    /(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*€/gi,
    /(?:montant|total|prix|coût|somme|de|à)\s*(?:de|:)?\s*(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)/gi,
    // NOUVEAU : Patterns plus simples pour capturer même avec peu de mots
    /\b(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)\b/g, // Tous les nombres (on filtrera après)
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const amount = parseNumber(match[1] || match[0]);
      if (amount && amount > 0 && amount < 10000000) {
        amounts.push(amount);
      }
    }
  }

  // Filtrer les nombres trop petits (probablement des quantités, pas des montants)
  const filtered = amounts.filter(a => a >= 10 || amounts.length === 1);
  
  return [...new Set(filtered.length > 0 ? filtered : amounts)]; // Supprimer les doublons
}

/**
 * Trouve le meilleur client correspondant (AMÉLIORÉ pour fonctionner avec peu de mots)
 */
function findClient(
  text: string,
  clients: Array<{ id: string; nom?: string; entreprise_nom?: string; prenom?: string }>
): { id: string; name: string } | null {
  const lowerText = text.toLowerCase();
  let bestMatch: { client: any; score: number; name: string } | null = null;

  for (const client of clients) {
    const clientName = (client.entreprise_nom || `${client.prenom || ''} ${client.nom || ''}`.trim() || client.nom || '').trim();
    if (!clientName) continue;

    const lowerClientName = clientName.toLowerCase();

    // Recherche exacte
    if (lowerText.includes(lowerClientName) || lowerClientName.includes(lowerText)) {
      return { id: client.id, name: clientName };
    }

    // Recherche par mots (AMÉLIORÉ : accepte les mots de 2+ caractères)
    const clientWords = lowerClientName.split(/\s+/);
    const textWords = lowerText.split(/\s+/);
    
    for (const clientWord of clientWords) {
      if (clientWord.length >= 2) {
        // Chercher dans les mots du texte
        for (const textWord of textWords) {
          if (textWord.length >= 2) {
            // Correspondance exacte ou partielle
            if (textWord.includes(clientWord) || clientWord.includes(textWord)) {
              return { id: client.id, name: clientName };
            }
            // Correspondance avec tolérance (ex: "mclem" trouve "MCLEM")
            if (textWord.toLowerCase() === clientWord.toLowerCase()) {
              return { id: client.id, name: clientName };
            }
            
            // NOUVEAU : Correction des erreurs de transcription courantes
            // Ex: "cyrille" → "cyril", "marie" → "mari", etc.
            // Si les mots sont très similaires (distance de Levenshtein <= 1 pour mots courts)
            const wordSim = similarity(textWord, clientWord);
            if (wordSim >= 0.8) {
              // Pour les mots courts (<= 7 caractères), accepter une similarité de 0.8
              // Pour les mots plus longs, garder 0.9
              const threshold = Math.max(0.7, clientWord.length <= 7 ? 0.8 : 0.9);
              if (wordSim >= threshold) {
                console.log(`✅ Match trouvé par similarité de mot: "${textWord}" ≈ "${clientWord}" (${(wordSim * 100).toFixed(1)}%)`);
                return { id: client.id, name: clientName };
              }
            }
          }
        }
      }
    }

    // Fuzzy matching global (seuil réduit pour accepter plus de correspondances)
    const sim = similarity(lowerText, lowerClientName);
    if (sim > 0.4 && (!bestMatch || sim > bestMatch.score)) {
      bestMatch = { client, score: sim, name: clientName };
    }
    
    // NOUVEAU : Fuzzy matching par mots individuels pour les noms courts
    // Ex: "cyrille" vs "cyril" - comparer chaque mot du client avec chaque mot du texte
    for (const clientWord of clientWords) {
      if (clientWord.length >= 3) { // Au moins 3 caractères pour éviter les faux positifs
        for (const textWord of textWords) {
          if (textWord.length >= 3) {
            const wordSim = similarity(textWord, clientWord);
            // Pour les noms courts, accepter une similarité plus faible (0.75)
            if (wordSim >= 0.75 && (!bestMatch || wordSim > bestMatch.score)) {
              console.log(`✅ Match potentiel par mot: "${textWord}" ≈ "${clientWord}" (${(wordSim * 100).toFixed(1)}%)`);
              bestMatch = { client, score: wordSim, name: clientName };
            }
          }
        }
      }
    }
  }

  // Seuil réduit pour accepter plus de correspondances (0.5 → 0.7 pour les noms courts)
  if (bestMatch) {
    // Pour les noms courts (<= 7 caractères), accepter un seuil plus bas (0.7)
    // Pour les noms plus longs, garder 0.5
    const threshold = bestMatch.name.length <= 7 ? 0.7 : 0.5;
    if (bestMatch.score >= threshold) {
      console.log(`✅ Client trouvé par fuzzy matching: "${bestMatch.name}" (score: ${(bestMatch.score * 100).toFixed(1)}%)`);
      return { id: bestMatch.client.id, name: bestMatch.name };
    }
  }

  return null;
}

/**
 * Extrait les lignes d'articles de manière intelligente
 */
function extractArticleLines(
  text: string,
  articles?: Array<{ code: string; libelle: string; prix_unitaire_ht: number; taux_tva: number }>,
  defaultTva: number = 20
): Array<{ description: string; quantite: number; prix: number; tva: number; code?: string }> {
  const lignes: Array<{ description: string; quantite: number; prix: number; tva: number; code?: string }> = [];
  const processed = new Set<string>(); // Pour éviter les doublons

  // 1. Chercher les codes d'articles d'abord (plus précis)
  if (articles && articles.length > 0) {
    for (const article of articles) {
      const codePattern = new RegExp(`\\b${article.code}\\b`, 'i');
      if (codePattern.test(text)) {
        // Chercher la quantité après le code
        const quantiteMatch = text.match(new RegExp(`${article.code}\\s+(\\d+(?:[.,]\\d+)?)`, 'i'));
        const quantite = quantiteMatch ? parseNumber(quantiteMatch[1]) || 1 : 1;

        const key = `${article.code}-${quantite}`;
        if (!processed.has(key)) {
          lignes.push({
            description: article.libelle,
            quantite,
            prix: article.prix_unitaire_ht,
            tva: article.taux_tva,
            code: article.code,
          });
          processed.add(key);
        }
      }
    }
  }

  // 2. Chercher les patterns structurés "description quantité prix"
  const structuredPatterns = [
    // "article X quantité Y prix Z"
    /(?:article|produit|service|prestation|item|ligne)\s+([A-Za-zÀ-ÿ\s]{3,60})\s+(?:quantité|qté|qte|quantite)\s+(\d+(?:[.,]\d+)?)\s+(?:prix|à|de|pour)\s+(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)/gi,
    // "X quantité Y à Z euros"
    /([A-Za-zÀ-ÿ\s]{3,60})\s+(?:quantité|qté|qte|quantite)\s+(\d+(?:[.,]\d+)?)\s+(?:à|de|pour)\s+(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*(?:euros?|€)/gi,
  ];

  for (const pattern of structuredPatterns) {
    const matches = Array.from(text.matchAll(pattern));
    for (const match of matches) {
      const description = match[1]?.trim().replace(/^(?:article|produit|service|prestation|item|ligne)\s+/i, '') || '';
      const quantite = parseNumber(match[2] || '1') || 1;
      const prix = parseNumber(match[3] || match[4] || '');

      if (description.length > 2 && prix && prix > 0) {
        const key = `${description.toLowerCase()}-${quantite}-${prix}`;
        if (!processed.has(key)) {
          // Chercher si c'est un article connu
          let codeArticle: string | undefined;
          let tvaArticle: number | undefined;

          if (articles && articles.length > 0) {
            const article = articles.find(a =>
              a.libelle.toLowerCase().includes(description.toLowerCase()) ||
              description.toLowerCase().includes(a.libelle.toLowerCase())
            );
            if (article) {
              codeArticle = article.code;
              tvaArticle = article.taux_tva;
            }
          }

          lignes.push({
            description: description.substring(0, 200),
            quantite,
            prix: Math.round(prix * 100) / 100,
            tva: tvaArticle || defaultTva,
            code: codeArticle,
          });
          processed.add(key);
        }
      }
    }
  }

  // ✅ NOUVEAU : Détecter les séparateurs explicites entre articles (virgule, point, "puis", "ensuite", "et", "plus", "également")
  // D'abord, diviser le texte en segments potentiels d'articles
  const articleSeparators = /(?:[,;]|\.\s+|puis|ensuite|et|plus|également|aussi|avec|sans|plus\s+un|plus\s+une|plus\s+deux|plus\s+trois)/gi;
  const segments = text.split(articleSeparators).map(s => s.trim()).filter(s => s.length > 0);
  
  // Si on trouve des segments séparés, traiter chaque segment comme un article potentiel
  if (segments.length > 1) {
    console.log(`📋 Détection de ${segments.length} segments séparés pour articles multiples`);
    for (const segment of segments) {
      // Chercher "description prix" dans chaque segment
      const segmentPattern = /([A-Za-zÀ-ÿ\s]{2,60}?)\s+(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*(?:euros?|€)?/i;
      const segmentMatch = segment.match(segmentPattern);
      
      if (segmentMatch) {
        let description = segmentMatch[1]?.trim() || '';
        const prix = parseNumber(segmentMatch[2] || '');
        
        // Nettoyer la description
        description = description
          .replace(/^(?:creer|créer|cree|crée|créé|facture|facturation|devis|pour|client|à|article|produit|service|prestation|item|ligne|montant|total|prix|coût|somme|de)\s+/i, '')
          .replace(/\s+(?:creer|créer|cree|crée|créé|facture|facturation|devis|pour|client|à|article|produit|service|prestation|item|ligne|montant|total|prix|coût|somme|de)\s+/gi, ' ')
          .trim();
        
        // Détecter quantité dans le segment (ex: "2 moteurs", "trois portails")
        let quantite = 1;
        const quantitePattern = /(?:^|\s)(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+(?:fois|×|x|\*)?/i;
        const quantiteMatch = segment.match(quantitePattern);
        if (quantiteMatch) {
          const qtyText = quantiteMatch[1].toLowerCase();
          const qtyMap: Record<string, number> = {
            'un': 1, 'une': 1, 'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5,
            'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9, 'dix': 10
          };
          quantite = qtyMap[qtyText] || parseNumber(qtyText) || 1;
        }
        
        if (description.length > 2 && prix && prix > 0) {
          const key = `${description.toLowerCase()}-${quantite}-${prix}`;
          if (!processed.has(key)) {
            // Chercher si c'est un article connu
            let codeArticle: string | undefined;
            let tvaArticle: number | undefined;
            
            if (articles && articles.length > 0) {
              const article = articles.find(a =>
                a.libelle.toLowerCase().includes(description.toLowerCase()) ||
                description.toLowerCase().includes(a.libelle.toLowerCase())
              );
              if (article) {
                codeArticle = article.code;
                tvaArticle = article.taux_tva;
                description = article.libelle;
              }
            }
            
            lignes.push({
              description: description.substring(0, 200),
              quantite,
              prix: Math.round(prix * 100) / 100,
              tva: tvaArticle || defaultTva,
              code: codeArticle,
            });
            processed.add(key);
            console.log(`✅ Ligne détectée depuis segment: "${description}" x${quantite} = ${prix}€`);
          }
        }
      }
    }
  }

  // 3. Chercher les patterns simples "description prix" (AMÉLIORÉ pour fonctionner avec peu de mots)
  // On cherche des séquences de mots suivies d'un nombre (seuil réduit à 2 caractères)
  // ✅ AMÉLIORATION : Ne traiter que si on n'a pas déjà trouvé de segments séparés
  if (segments.length <= 1) {
    const simplePattern = /([A-Za-zÀ-ÿ\s]{2,60}?)\s+(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*(?:euros?|€)?/gi;
    const simpleMatches = Array.from(text.matchAll(simplePattern));

    for (const match of simpleMatches) {
    let description = match[1]?.trim() || '';
    const prix = parseNumber(match[2] || '');

    // Nettoyer la description (enlever les mots-clés, notamment "créer facture" ou "créer devis")
    description = description
      .replace(/^(?:creer|créer|cree|crée|créé|facture|facturation|devis|devis|pour|client|à|article|produit|service|prestation|item|ligne|puis|ensuite|et|plus|montant|total|prix|coût|somme|de)\s+/i, '')
      .replace(/\s+(?:creer|créer|cree|crée|créé|facture|facturation|devis|devis|pour|client|à|article|produit|service|prestation|item|ligne|puis|ensuite|et|plus|montant|total|prix|coût|somme|de)\s+/gi, ' ')
      .trim();

    // Ignorer si la description est trop courte ou contient des nombres (seuil réduit à 2 caractères)
    if (description.length < 2 || /^\d+$/.test(description) || description.length > 60) continue;

    // Ignorer si c'est un nom de client ou un mot-clé
    const ignoreWords = ['facture', 'facturation', 'devis', 'creer', 'créer', 'cree', 'crée', 'créé', 'pour', 'client', 'montant', 'total', 'prix', 'tva', 'euros', 'euro', '€'];
    if (ignoreWords.some(w => description.toLowerCase().includes(w))) continue;

    if (prix && prix > 0) {
      const key = `${description.toLowerCase()}-${prix}`;
      if (!processed.has(key)) {
        // Chercher si c'est un article connu
        let codeArticle: string | undefined;
        let tvaArticle: number | undefined;

        if (articles && articles.length > 0) {
          const article = articles.find(a =>
            a.libelle.toLowerCase().includes(description.toLowerCase()) ||
            description.toLowerCase().includes(a.libelle.toLowerCase())
          );
          if (article) {
            codeArticle = article.code;
            tvaArticle = article.taux_tva;
            description = article.libelle; // Utiliser le libellé exact
          }
        }

        lignes.push({
          description: description.substring(0, 200),
          quantite: 1,
          prix: Math.round(prix * 100) / 100,
          tva: tvaArticle || defaultTva,
          code: codeArticle,
        });
        processed.add(key);
      }
    }
  }
  } // Fermeture du if (segments.length <= 1)

  // 4. ✅ AMÉLIORATION : Détecter plusieurs articles séparés par "puis", "ensuite", "et", "plus", "également", "aussi", virgule
  // Pattern amélioré pour capturer plusieurs articles dans une phrase
  const multiPattern = /([A-Za-zÀ-ÿ\s]{3,60})\s+(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*(?:euros?|€)?(?:\s*[,;]?\s*(?:puis|ensuite|et|plus|également|aussi|avec)\s+([A-Za-zÀ-ÿ\s]{3,60})\s+(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*(?:euros?|€)?)+/gi;
  const multiMatches = Array.from(text.matchAll(multiPattern));
  
  // ✅ NOUVEAU : Pattern alternatif pour détecter "article1 X€, article2 Y€, article3 Z€"
  const commaSeparatedPattern = /([A-Za-zÀ-ÿ\s]{3,60})\s+(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*(?:euros?|€)?(?:\s*[,;]\s*([A-Za-zÀ-ÿ\s]{3,60})\s+(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*(?:euros?|€)?)+/gi;
  const commaMatches = Array.from(text.matchAll(commaSeparatedPattern));
  
  // Combiner les deux types de matches
  const allMultiMatches = [...multiMatches, ...commaMatches];

  for (const match of allMultiMatches) {
    // Traiter le premier article
    if (match[1] && match[2]) {
      let desc1 = match[1].trim();
      const prix1 = parseNumber(match[2] || '');
      
      // Nettoyer la description
      desc1 = desc1.replace(/^(?:creer|créer|cree|crée|créé|facture|facturation|devis|pour|client|à)\s+/i, '').trim();
      
      // Détecter quantité dans la description
      let quantite1 = 1;
      const qtyMatch1 = desc1.match(/(?:^|\s)(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+(?:fois|×|x|\*)?/i);
      if (qtyMatch1) {
        const qtyText = qtyMatch1[1].toLowerCase();
        const qtyMap: Record<string, number> = {
          'un': 1, 'une': 1, 'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5,
          'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9, 'dix': 10
        };
        quantite1 = qtyMap[qtyText] || parseNumber(qtyText) || 1;
        // Retirer la quantité de la description
        desc1 = desc1.replace(/(?:^|\s)(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+(?:fois|×|x|\*)?/i, '').trim();
      }

      if (desc1.length > 2 && prix1 && prix1 > 0) {
        const key = `${desc1.toLowerCase()}-${quantite1}-${prix1}`;
        if (!processed.has(key)) {
          // Chercher si c'est un article connu
          let codeArticle: string | undefined;
          let tvaArticle: number | undefined;
          
          if (articles && articles.length > 0) {
            const article = articles.find(a =>
              a.libelle.toLowerCase().includes(desc1.toLowerCase()) ||
              desc1.toLowerCase().includes(a.libelle.toLowerCase())
            );
            if (article) {
              codeArticle = article.code;
              tvaArticle = article.taux_tva;
              desc1 = article.libelle;
            }
          }
          
          lignes.push({
            description: desc1.substring(0, 200),
            quantite: quantite1,
            prix: Math.round(prix1 * 100) / 100,
            tva: tvaArticle || defaultTva,
            code: codeArticle,
          });
          processed.add(key);
          console.log(`✅ Ligne multi-article 1: "${desc1}" x${quantite1} = ${prix1}€`);
        }
      }
    }

    // Traiter les articles suivants (paires match[3], match[4], etc.)
    for (let i = 3; i < match.length - 1; i += 2) {
      if (match[i] && match[i + 1]) {
        let desc = match[i].trim();
        const prix = parseNumber(match[i + 1] || '');
        
        // Nettoyer la description
        desc = desc.replace(/^(?:puis|ensuite|et|plus|également|aussi|avec)\s+/i, '').trim();
        
        // Détecter quantité dans la description
        let quantite = 1;
        const qtyMatch = desc.match(/(?:^|\s)(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+(?:fois|×|x|\*)?/i);
        if (qtyMatch) {
          const qtyText = qtyMatch[1].toLowerCase();
          const qtyMap: Record<string, number> = {
            'un': 1, 'une': 1, 'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5,
            'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9, 'dix': 10
          };
          quantite = qtyMap[qtyText] || parseNumber(qtyText) || 1;
          // Retirer la quantité de la description
          desc = desc.replace(/(?:^|\s)(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+(?:fois|×|x|\*)?/i, '').trim();
        }

        if (desc.length > 2 && prix && prix > 0) {
          const key = `${desc.toLowerCase()}-${quantite}-${prix}`;
          if (!processed.has(key)) {
            // Chercher si c'est un article connu
            let codeArticle: string | undefined;
            let tvaArticle: number | undefined;
            
            if (articles && articles.length > 0) {
              const article = articles.find(a =>
                a.libelle.toLowerCase().includes(desc.toLowerCase()) ||
                desc.toLowerCase().includes(a.libelle.toLowerCase())
              );
              if (article) {
                codeArticle = article.code;
                tvaArticle = article.taux_tva;
                desc = article.libelle;
              }
            }
            
            lignes.push({
              description: desc.substring(0, 200),
              quantite,
              prix: Math.round(prix * 100) / 100,
              tva: tvaArticle || defaultTva,
              code: codeArticle,
            });
            processed.add(key);
            console.log(`✅ Ligne multi-article ${(i-1)/2 + 1}: "${desc}" x${quantite} = ${prix}€`);
          }
        }
      }
    }
  }

  return lignes;
}

/**
 * Parse le texte vocal pour extraire les informations
 */
export function parseVoiceInput(
  text: string,
  clients: Array<{ id: string; nom?: string; entreprise_nom?: string; prenom?: string }>,
  articles?: Array<{ code: string; libelle: string; prix_unitaire_ht: number; taux_tva: number }>
): ParsedInvoiceData {
  const result: ParsedInvoiceData = {};
  const lowerText = text.toLowerCase();

  // 1. Extraire le client (AMÉLIORÉ pour détecter "creer facture [nom client]")
  // D'abord, chercher le client dans tout le texte
  const clientMatch = findClient(text, clients);
  if (clientMatch) {
    result.client = clientMatch.id;
    console.log('✅ Client trouvé:', clientMatch.name);
  } else {
    // Si pas trouvé, essayer de chercher après "creer facture", "creer devis" ou "facture"/"devis"
    const factureIndex = lowerText.indexOf('facture');
    const devisIndex = lowerText.indexOf('devis');
    const index = factureIndex !== -1 ? factureIndex : (devisIndex !== -1 ? devisIndex : -1);
    
    if (index !== -1) {
      const keyword = factureIndex !== -1 ? 'facture' : 'devis';
      const afterKeyword = text.substring(index + keyword.length).trim();
      if (afterKeyword.length > 0) {
        const clientMatchAfter = findClient(afterKeyword, clients);
        if (clientMatchAfter) {
          result.client = clientMatchAfter.id;
          console.log(`✅ Client trouvé après "${keyword}":`, clientMatchAfter.name);
        }
      }
    }
  }

  // 2. Extraire les montants (AMÉLIORÉ)
  const amounts = extractAmounts(text);
  if (amounts.length > 0) {
    // Prendre le montant le plus grand (probablement le total)
    result.montant = Math.max(...amounts);
  } else {
    // Si aucun montant trouvé, chercher n'importe quel nombre (peut être un montant)
    const numberMatch = text.match(/\b(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)\b/);
    if (numberMatch) {
      const num = parseNumber(numberMatch[1]);
      if (num && num >= 10) {
        result.montant = num;
      }
    }
  }

  // 3. Extraire le taux de TVA
  const tvaPatterns = [
    /(?:tva|t\.v\.a\.?|t\.v\.a)\s*(?:de|à|:)?\s*(\d+(?:[.,]\d+)?)\s*(?:%|pourcent|pour\s*cent)/gi,
    /(\d+(?:[.,]\d+)?)\s*%\s*(?:de\s*)?(?:tva|t\.v\.a)/gi,
    /(?:taux\s*)?(?:de\s*)?tva\s*(?:à|de)?\s*(\d+(?:[.,]\d+)?)/gi,
  ];

  for (const pattern of tvaPatterns) {
    const match = text.match(pattern);
    if (match) {
      const tva = parseNumber(match[1]?.replace(',', '.') || '');
      if (tva && tva >= 0 && tva <= 100) {
        result.taux_tva = tva;
        break;
      }
    }
  }

  if (!result.taux_tva) {
    result.taux_tva = 20; // Par défaut
  }

  // 4. Extraire les lignes d'articles
  const lignes = extractArticleLines(text, articles, result.taux_tva);
  if (lignes.length > 0) {
    result.lignes = lignes;
  } else if (result.description && result.montant) {
    // Si pas de lignes mais description + montant, créer une ligne par défaut
    result.lignes = [{
      description: result.description.substring(0, 200),
      quantite: 1,
      prix: result.montant,
      tva: result.taux_tva,
    }];
  }

  // 5. Extraire la description (AMÉLIORÉ pour fonctionner avec peu de mots)
  if (!result.description || result.description.length < 3) {
    const descriptionKeywords = ['pour', 'concernant', 'relatif à', 'description', 'détails', 'prestation', 'service', 'travaux', 'développement', 'création', 'réalisation', 'facture'];
    
    for (const keyword of descriptionKeywords) {
      const index = lowerText.indexOf(keyword);
      if (index !== -1) {
        let description = text.substring(index + keyword.length).trim();
        // Nettoyer
        description = description
          .replace(/\d+[\s,.]?\d*\s*(?:euros?|€)/gi, '')
          .replace(/\d+\s*%/g, '')
          .replace(/tva/gi, '')
          .trim();
        
        if (description.length > 2) {
          result.description = description.substring(0, 300);
          break;
        }
      }
    }
    
    // Si toujours pas de description, prendre les premiers mots (sauf les mots-clés)
    if (!result.description || result.description.length < 3) {
      const words = text.split(/\s+/).filter(w => {
        const lower = w.toLowerCase();
        return !['facture', 'pour', 'client', 'montant', 'total', 'prix', 'tva', 'euros', 'euro', '€', 'créer', 'créé', 'les', 'le', 'la', 'un', 'une', 'des'].includes(lower) && 
               lower.length > 2 && 
               !/^\d+$/.test(lower);
      });
      if (words.length > 0) {
        result.description = words.slice(0, 10).join(' ').substring(0, 300);
      } else {
        // Si vraiment rien, utiliser "Facture" comme description par défaut
        result.description = 'Facture';
      }
    }
  }

  // 6. Extraire la date
  const today = new Date();
  if (lowerText.includes('aujourd\'hui') || lowerText.includes('aujourd hui')) {
    result.date = today.toISOString().split('T')[0];
  } else {
    const datePattern = /(?:le\s+)?(\d{1,2})\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i;
    const dateMatch = text.match(datePattern);
    if (dateMatch) {
      const day = parseInt(dateMatch[1]);
      const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      const monthIndex = monthNames.findIndex(m => lowerText.includes(m));
      if (monthIndex !== -1) {
        const year = today.getFullYear();
        const date = new Date(year, monthIndex, day);
        result.date = date.toISOString().split('T')[0];
      }
    }
  }

  // 7. Extraire la date d'échéance
  const echeancePatterns = [
    /(?:échéance|échéant|payable)\s+(?:le\s+)?(\d{1,2})\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i,
    /(?:échéance|échéant|payable)\s+(?:dans|sous)\s+(\d+)\s+(?:jours?|jour)/i,
    /(?:échéance|échéant|payable)\s+(?:dans|sous)\s+(\d+)\s+(?:semaines?|semaine)/i,
    /(?:échéance|échéant|payable)\s+(?:dans|sous)\s+(\d+)\s+(?:mois)/i,
  ];

  for (const pattern of echeancePatterns) {
    const match = text.match(pattern);
    if (match) {
      if (pattern.source.includes('jour')) {
        const jours = parseInt(match[1]);
        const dateEcheance = new Date(today);
        dateEcheance.setDate(dateEcheance.getDate() + jours);
        result.date_echeance = dateEcheance.toISOString().split('T')[0];
        break;
      } else if (pattern.source.includes('semaine')) {
        const semaines = parseInt(match[1]);
        const dateEcheance = new Date(today);
        dateEcheance.setDate(dateEcheance.getDate() + (semaines * 7));
        result.date_echeance = dateEcheance.toISOString().split('T')[0];
        break;
      } else if (pattern.source.includes('mois')) {
        const mois = parseInt(match[1]);
        const dateEcheance = new Date(today);
        dateEcheance.setMonth(dateEcheance.getMonth() + mois);
        result.date_echeance = dateEcheance.toISOString().split('T')[0];
        break;
      } else {
        const day = parseInt(match[1]);
        const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
        const monthIndex = monthNames.findIndex(m => lowerText.includes(m));
        if (monthIndex !== -1) {
          const year = today.getFullYear();
          const date = new Date(year, monthIndex, day);
          result.date_echeance = date.toISOString().split('T')[0];
          break;
        }
      }
    }
  }

  // 8. Extraire les notes
  const notesKeywords = ['notes', 'remarque', 'remarques', 'commentaire', 'commentaires', 'info', 'informations'];
  for (const keyword of notesKeywords) {
    const index = lowerText.indexOf(keyword);
    if (index !== -1) {
      const notes = text.substring(index + keyword.length).trim();
      if (notes.length > 5) {
        result.notes = notes.substring(0, 500);
        break;
      }
    }
  }

  return result;
}
