// Test de l'Edge Function parse-invoice-ai
const testEdgeFunction = async () => {
  console.log('🧪 TEST EDGE FUNCTION - Démarrage...\n');
  
  // Récupérer les variables d'environnement Supabase
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewlozuwvrteopotfizcr.supabase.co';
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  
  if (!SUPABASE_ANON_KEY) {
    console.error('❌ SUPABASE_ANON_KEY non trouvée');
    console.log('💡 Vous devez avoir SUPABASE_ANON_KEY dans .env.local');
    return;
  }
  
  const testData = {
    text: 'creer facture groupe mclem',
    clients: [
      {
        id: 'test-123',
        entreprise_nom: 'Groupe MCLEM',
        nom: 'MCLEM',
      }
    ],
    articles: []
  };
  
  console.log('📤 Données de test:', JSON.stringify(testData, null, 2));
  console.log('\n🚀 Appel Edge Function...\n');
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/parse-invoice-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(testData),
    });
    
    console.log('📡 Status:', response.status);
    console.log('📡 OK:', response.ok);
    
    const result = await response.json();
    console.log('\n📦 Réponse complète:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ SUCCÈS !');
      console.log('🤖 IA utilisée:', result.ai_used ? 'OUI' : 'NON');
      console.log('🔧 Provider:', result.ai_provider || 'local');
      console.log('📊 Données parsées:', JSON.stringify(result.parsed, null, 2));
      
      if (result.ai_provider === 'gemini') {
        console.log('\n✅ GEMINI FONCTIONNE !');
      } else if (result.ai_provider === 'openai') {
        console.log('\n⚠️ Gemini non utilisé, OpenAI utilisé à la place');
      } else {
        console.log('\n⚠️ Aucune IA utilisée, parsing local seulement');
      }
    } else {
      console.error('\n❌ ERREUR:', result.error);
    }
    
  } catch (error) {
    console.error('\n❌ ERREUR APPEL:');
    console.error(error);
  }
};

testEdgeFunction().catch(console.error);

