// Test automatisé de Gemini
const SUPABASE_URL = 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpenNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI4ODQ2MDAsImV4cCI6MjA0ODQ2MDYwMH0.7qJ8K9L0mN1O2P3Q4R5S6T7U8V9W0X1Y2Z3A4B5C6D7E8F9G0H1I2J3K4L5M6N7O8P9Q0R1S2T3U4V5W6X7Y8Z9A0B1C2D3E4F5G6H7I8J9K0L1M2N3O4P5Q6R7S8T9U0V1W2X3Y4Z5';

async function testGemini() {
  console.log('🧪 TEST AUTOMATISÉ GEMINI\n');
  
  const testData = {
    text: 'creer facture groupe mclem',
    clients: [{ id: 'test-123', entreprise_nom: 'Groupe MCLEM' }],
    articles: []
  };
  
  try {
    console.log('📤 Appel Edge Function...');
    const response = await fetch(`${SUPABASE_URL}/functions/v1/parse-invoice-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(testData),
    });
    
    const result = await response.json();
    
    console.log('📊 RÉSULTATS:');
    console.log('   Status:', response.status);
    console.log('   Success:', result.success);
    console.log('   AI Used:', result.ai_used);
    console.log('   Provider:', result.ai_provider || 'local');
    
    if (result.ai_provider === 'gemini') {
      console.log('\n✅ GEMINI FONCTIONNE !');
      return true;
    } else {
      console.log('\n❌ GEMINI NON UTILISÉ');
      console.log('   Provider utilisé:', result.ai_provider || 'local');
      return false;
    }
  } catch (error) {
    console.error('❌ ERREUR:', error.message);
    return false;
  }
}

testGemini();
