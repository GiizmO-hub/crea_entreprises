// Script de test pour vérifier que Gemini fonctionne
const testGemini = async () => {
  console.log('🧪 TEST GEMINI - Démarrage...\n');
  
  // Récupérer la clé depuis les variables d'environnement Supabase
  // Note: Pour tester localement, vous devez avoir GEMINI_API_KEY dans .env.local ou similaire
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY non trouvée dans les variables d\'environnement');
    console.log('💡 Pour tester, vous devez avoir GEMINI_API_KEY configurée');
    console.log('💡 Dans Supabase, vérifiez avec: supabase secrets list');
    return;
  }
  
  console.log('✅ GEMINI_API_KEY trouvée');
  console.log('📏 Longueur de la clé:', GEMINI_API_KEY.length);
  console.log('🔑 Préfixe de la clé:', GEMINI_API_KEY.substring(0, 10) + '...\n');
  
  const testPrompt = `Tu es un expert en facturation française. Analyse ce texte et extrais les informations de facture.

TEXTE À ANALYSER:
"creer facture groupe mclem"

CLIENTS DISPONIBLES:
- Groupe MCLEM (ID: test-123)

Réponds UNIQUEMENT en JSON valide:
{
  "client_id": "id du client si trouvé, sinon null",
  "montant": nombre ou null,
  "taux_tva": nombre ou null,
  "description": "description ou null",
  "lignes": []
}`;

  try {
    console.log('🚀 Appel API Gemini...');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: testPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2000,
          responseMimeType: 'application/json',
        },
      }),
    });

    console.log('📡 Status:', response.status);
    console.log('📡 OK:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ ERREUR API Gemini:');
      console.error('   Status:', response.status);
      console.error('   Réponse:', errorText);
      return;
    }

    const data = await response.json();
    console.log('\n📦 Réponse complète:', JSON.stringify(data, null, 2));
    
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      console.error('❌ Aucun contenu dans la réponse');
      console.log('📦 Structure:', JSON.stringify(data, null, 2));
      return;
    }
    
    console.log('\n📝 Contenu extrait:', content);
    
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      console.log('\n✅ PARSING RÉUSSI !');
      console.log('📊 Données parsées:', JSON.stringify(parsed, null, 2));
      console.log('\n✅ GEMINI FONCTIONNE CORRECTEMENT !');
    } catch (parseError) {
      console.error('\n❌ ERREUR PARSING JSON:');
      console.error(parseError);
      console.log('\n📝 Contenu brut:', content);
    }
    
  } catch (error) {
    console.error('\n❌ ERREUR APPEL:');
    console.error(error);
  }
};

// Exécuter le test
testGemini().catch(console.error);

