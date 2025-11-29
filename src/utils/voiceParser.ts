/**
 * Parse le texte vocal pour extraire les informations de facture
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
    code?: string; // Code article si trouvé
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
 * Parse le texte vocal pour extraire les informations
 */
export function parseVoiceInput(
  text: string, 
  clients: Array<{ id: string; nom?: string; entreprise_nom?: string; prenom?: string }>,
  articles?: Array<{ code: string; libelle: string; prix_unitaire_ht: number; taux_tva: number }>
): ParsedInvoiceData {
  const lowerText = text.toLowerCase();
  const result: ParsedInvoiceData = {};

  // Extraire le client avec fuzzy matching amélioré
  // Chercher des patterns comme "pour [nom]", "client [nom]", "facture [nom]", etc.
  const clientPatterns = [
    /(?:pour|client|facture|à)\s+([A-Za-zÀ-ÿ\s]{2,30})/gi,
    /([A-Za-zÀ-ÿ\s]{2,30})\s+(?:montant|euros?|€|facture)/gi,
  ];

  let foundClientName = '';
  for (const pattern of clientPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const potentialName = match[1].trim();
      if (potentialName.length > 2) {
        // Chercher dans la liste des clients avec fuzzy matching
        let bestMatch: { client: any; score: number } | null = null;
        
        for (const client of clients) {
          const clientName = (client.entreprise_nom || `${client.prenom || ''} ${client.nom || ''}`.trim() || client.nom || '').toLowerCase();
          if (!clientName) continue;
          
          // Recherche exacte
          if (lowerText.includes(clientName) || clientName.includes(potentialName.toLowerCase())) {
            result.client = client.id;
            foundClientName = clientName;
            break;
          }
          
          // Fuzzy matching
          const sim = similarity(potentialName.toLowerCase(), clientName);
          if (sim > 0.6 && (!bestMatch || sim > bestMatch.score)) {
            bestMatch = { client, score: sim };
          }
        }
        
        if (!result.client && bestMatch && bestMatch.score > 0.7) {
          result.client = bestMatch.client.id;
          foundClientName = bestMatch.client.entreprise_nom || bestMatch.client.nom || '';
        }
        
        if (result.client) break;
      }
    }
    if (result.client) break;
  }
  
  // Si pas trouvé avec patterns, chercher directement dans le texte
  if (!result.client) {
    for (const client of clients) {
      const clientName = (client.entreprise_nom || `${client.prenom || ''} ${client.nom || ''}`.trim() || client.nom || '').toLowerCase();
      if (clientName && lowerText.includes(clientName)) {
        result.client = client.id;
        break;
      }
    }
  }

  // Extraire le montant avec patterns améliorés
  const amountPatterns = [
    /(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*(?:euros?|€|euro|eur)/gi,
    /(?:montant|total|prix|coût|somme|de|à)\s*(?:de|:)?\s*(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)/gi,
    /(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*€/gi,
    /(\d+[\s,.]?\d*)\s*(?:euros?|€)/gi,
  ];

  const amounts: number[] = [];
  for (const pattern of amountPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const amountStr = match[1] || match[0];
      const cleaned = amountStr.replace(/[^\d,.]/g, '').replace(/\s/g, '').replace(',', '.');
      const amount = parseFloat(cleaned);
      if (!isNaN(amount) && amount > 0 && amount < 10000000) {
        amounts.push(amount);
      }
    }
  }
  
  // Prendre le montant le plus grand (probablement le total)
  if (amounts.length > 0) {
    result.montant = Math.max(...amounts);
  }

  // Extraire le taux de TVA avec patterns améliorés
  const tvaPatterns = [
    /(?:tva|t\.v\.a\.?|t\.v\.a)\s*(?:de|à|:)?\s*(\d+(?:[.,]\d+)?)\s*(?:%|pourcent|pour\s*cent)/gi,
    /(\d+(?:[.,]\d+)?)\s*%\s*(?:de\s*)?(?:tva|t\.v\.a)/gi,
    /(?:taux\s*)?(?:de\s*)?tva\s*(?:à|de)?\s*(\d+(?:[.,]\d+)?)/gi,
  ];

  for (const pattern of tvaPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const tvaStr = match[1].replace(',', '.');
      const tva = parseFloat(tvaStr);
      if (!isNaN(tva) && tva >= 0 && tva <= 100) {
        result.taux_tva = tva;
        break;
      }
    }
  }
  
  // Si pas de TVA trouvée, utiliser 20% par défaut
  if (!result.taux_tva) {
    result.taux_tva = 20;
  }

  // Extraire la description avec patterns améliorés
  const descriptionKeywords = [
    'pour', 'concernant', 'relatif à', 'description', 'détails', 
    'prestation', 'service', 'travaux', 'prestation de', 'pour le',
    'développement', 'création', 'réalisation'
  ];
  
  let descriptionFound = false;
  for (const keyword of descriptionKeywords) {
    const index = lowerText.indexOf(keyword);
    if (index !== -1) {
      let description = text.substring(index + keyword.length).trim();
      // Nettoyer la description (enlever les montants, dates, etc.)
      description = description
        .replace(/\d+[\s,.]?\d*\s*(?:euros?|€)/gi, '')
        .replace(/\d+\s*%/g, '')
        .replace(/tva/gi, '')
        .trim();
      
      if (description.length > 5) {
        // Limiter à 300 caractères mais garder les phrases complètes
        if (description.length > 300) {
          const lastPeriod = description.lastIndexOf('.', 300);
          description = description.substring(0, lastPeriod > 0 ? lastPeriod + 1 : 300);
        }
        result.description = description;
        descriptionFound = true;
        break;
      }
    }
  }

  // Si pas de description trouvée, extraire le texte entre le client et les montants
  if (!descriptionFound && foundClientName) {
    const clientIndex = lowerText.indexOf(foundClientName.toLowerCase());
    if (clientIndex !== -1) {
      let description = text.substring(clientIndex + foundClientName.length).trim();
      // Enlever les montants et autres infos
      description = description
        .replace(/\d+[\s,.]?\d*\s*(?:euros?|€)/gi, '')
        .replace(/\d+\s*%/g, '')
        .replace(/tva/gi, '')
        .replace(/aujourd'hui/gi, '')
        .trim();
      
      if (description.length > 10) {
        if (description.length > 300) {
          const lastPeriod = description.lastIndexOf('.', 300);
          description = description.substring(0, lastPeriod > 0 ? lastPeriod + 1 : 300);
        }
        result.description = description;
      }
    }
  }
  
  // Si toujours pas de description, prendre une partie du texte
  if (!result.description && text.length > 20) {
    let description = text;
    // Enlever les parties déjà extraites
    if (foundClientName) {
      description = description.replace(new RegExp(foundClientName, 'gi'), '');
    }
    description = description
      .replace(/\d+[\s,.]?\d*\s*(?:euros?|€)/gi, '')
      .replace(/\d+\s*%/g, '')
      .trim();
    
    if (description.length > 10) {
      result.description = description.substring(0, 200);
    }
  }

  // Extraire des lignes d'articles avec patterns améliorés et recherche d'articles existants
  const lignePatterns = [
    // Pattern: "article X quantité Y prix Z"
    /(?:article|produit|service|prestation|item)\s+(.+?)\s+(?:quantité|qté|qte|quantite)\s+(\d+(?:[.,]\d+)?)\s+(?:prix|à|de|pour)\s+(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)/gi,
    // Pattern: "X quantité Y à Z euros"
    /(.+?)\s+(?:quantité|qté|qte|quantite)\s+(\d+(?:[.,]\d+)?)\s+(?:à|de|pour)\s+(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*(?:euros?|€)/gi,
    // Pattern: "X Y unités Z euros"
    /(.+?)\s+(\d+(?:[.,]\d+)?)\s+(?:unités?|unites?|fois|×)\s+(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*(?:euros?|€)/gi,
    // Pattern: "X Y x Z euros"
    /(.+?)\s+(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*(?:euros?|€)/gi,
    // Pattern: "code MO1 quantité 10" (recherche par code article)
    /(?:code|article)\s+([A-Z0-9]{2,10})\s+(?:quantité|qté|qte|quantite)\s+(\d+(?:[.,]\d+)?)/gi,
    // Pattern: "MO1 10" (code directement suivi de quantité)
    /\b([A-Z]{2,10}\d*)\s+(\d+(?:[.,]\d+)?)\b/gi,
  ];
  
  const lignes: Array<{ description: string; quantite: number; prix: number; tva?: number; code?: string }> = [];
  
  for (const pattern of lignePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      let description = match[1]?.trim() || '';
      const quantiteStr = (match[2] || match[3] || '').replace(',', '.');
      const prixStr = (match[3] || match[4] || '').replace(/[^\d,.]/g, '').replace(/\s/g, '').replace(',', '.');
      
      const quantite = parseFloat(quantiteStr);
      let prix = parseFloat(prixStr);
      let codeArticle: string | undefined;
      let tvaArticle: number | undefined;

      // Si la description ressemble à un code article (ex: MO1, APP, etc.)
      if (description && /^[A-Z]{2,10}\d*$/i.test(description)) {
        codeArticle = description.toUpperCase();
        // Chercher l'article correspondant
        if (articles && articles.length > 0) {
          const article = articles.find(a => a.code.toUpperCase() === codeArticle);
          if (article) {
            description = article.libelle;
            if (!prix || prix === 0) {
              prix = article.prix_unitaire_ht;
            }
            tvaArticle = article.taux_tva;
          }
        }
      } else if (articles && articles.length > 0) {
        // Chercher si la description correspond à un article
        const article = articles.find(a => 
          a.libelle.toLowerCase().includes(description.toLowerCase()) ||
          description.toLowerCase().includes(a.libelle.toLowerCase())
        );
        if (article) {
          codeArticle = article.code;
          if (!prix || prix === 0) {
            prix = article.prix_unitaire_ht;
          }
          tvaArticle = article.taux_tva;
        }
      }

      if (description && description.length > 2 && !isNaN(quantite) && quantite > 0 && !isNaN(prix) && prix > 0) {
        // Vérifier que cette ligne n'existe pas déjà
        const exists = lignes.some(l => 
          (l.code && codeArticle && l.code === codeArticle) ||
          (l.description.toLowerCase() === description.toLowerCase() && 
           l.quantite === quantite && 
           l.prix === prix)
        );
        
        if (!exists) {
          lignes.push({
            description: description.substring(0, 200),
            quantite: Math.round(quantite * 100) / 100,
            prix: Math.round(prix * 100) / 100,
            tva: tvaArticle || result.taux_tva || 20,
            code: codeArticle,
          });
        }
      }
    }
  }

  if (lignes.length > 0) {
    result.lignes = lignes;
  }

  // Extraire la date de facturation (patterns comme "aujourd'hui", "le 15 janvier", etc.)
  const today = new Date();
  if (lowerText.includes('aujourd\'hui') || lowerText.includes('aujourd hui')) {
    result.date = today.toISOString().split('T')[0];
  } else {
    // Chercher des patterns de date
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

  // Extraire la date d'échéance
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
        // Date spécifique
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

  // Extraire les notes (texte après "notes", "remarque", "commentaire", etc.)
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

