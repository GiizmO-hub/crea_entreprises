import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 TENTATIVE DE DÉPLOIEMENT VIA MCP\n');
console.log('='.repeat(80));

// Lire le code de l'Edge Function
const functionPath = path.join(__dirname, '..', 'supabase', 'functions', 'create-stripe-checkout', 'index.ts');

if (!fs.existsSync(functionPath)) {
  console.error(`❌ Fichier Edge Function non trouvé: ${functionPath}`);
  process.exit(1);
}

const functionCode = fs.readFileSync(functionPath, 'utf8');
console.log(`✅ Code Edge Function lu (${functionCode.length} caractères)\n`);

console.log('⚠️  Supabase ne permet pas le déploiement automatique via API');
console.log('📋 Le déploiement doit être fait manuellement via Dashboard ou CLI\n');

console.log('💡 SOLUTION LA PLUS RAPIDE :\n');
console.log('1. Ouvrez le navigateur');
console.log('2. Allez sur : https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/functions');
console.log('3. Cliquez sur "Create new function"');
console.log('4. Nom : create-stripe-checkout');
console.log('5. Copiez-collez le code ci-dessous\n');

console.log('═══════════════════════════════════════════════════════════════');
console.log('CODE À COPIER :');
console.log('═══════════════════════════════════════════════════════════════\n');
console.log(functionCode);
console.log('\n═══════════════════════════════════════════════════════════════\n');

// Créer un fichier HTML pour faciliter la copie
const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Edge Function - Code à copier</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            color: #4ec9b0;
        }
        .instructions {
            background: #252526;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            border-left: 4px solid #007acc;
        }
        pre {
            background: #0d0d0d;
            padding: 20px;
            border-radius: 5px;
            overflow-x: auto;
            border: 1px solid #3e3e42;
        }
        code {
            color: #9cdcfe;
        }
        .copy-btn {
            background: #007acc;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px 0;
        }
        .copy-btn:hover {
            background: #005a9e;
        }
        .success {
            color: #4ec9b0;
            display: none;
        }
    </style>
</head>
<body>
    <h1>🚀 Edge Function - create-stripe-checkout</h1>
    
    <div class="instructions">
        <h2>📋 Instructions de déploiement :</h2>
        <ol>
            <li>Allez sur <a href="https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/functions" target="_blank" style="color: #4ec9b0;">Supabase Dashboard → Edge Functions</a></li>
            <li>Cliquez sur "Create new function"</li>
            <li>Nom : <strong>create-stripe-checkout</strong></li>
            <li>Cliquez sur le bouton "Copier le code" ci-dessous</li>
            <li>Collez dans l'éditeur du Dashboard</li>
            <li>Cliquez sur "Deploy"</li>
            <li>Configurez les secrets : Settings → Edge Functions → Secrets</li>
            <li>Redéployez après configuration des secrets</li>
        </ol>
    </div>
    
    <button class="copy-btn" onclick="copyCode()">📋 Copier le code</button>
    <div class="success" id="success">✅ Code copié !</div>
    
    <pre><code id="code">${functionCode.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
    
    <div class="instructions">
        <h2>🔐 Secrets à configurer :</h2>
        <ul>
            <li><strong>STRIPE_SECRET_KEY</strong> = sk_test_51SXOlcEMmOXNQayfw50s9s0qct4kEulo0NRH2exFEvjhEW7p4NYbKCSAGqjKWDJq4VTu0SA3lMp5UiTneXECQAmM00idhC3wRk</li>
            <li><strong>STRIPE_WEBHOOK_SECRET</strong> = whsec_oS5pozHfNYgKrlKMPnvw1bm7tW2caPef</li>
        </ul>
    </div>
    
    <script>
        function copyCode() {
            const code = document.getElementById('code').innerText;
            navigator.clipboard.writeText(code).then(() => {
                const success = document.getElementById('success');
                success.style.display = 'block';
                setTimeout(() => {
                    success.style.display = 'none';
                }, 2000);
            });
        }
    </script>
</body>
</html>`;

const htmlPath = path.join(__dirname, '..', 'DEPLOY_EDGE_FUNCTION.html');
fs.writeFileSync(htmlPath, htmlContent, 'utf8');

console.log(`✅ Fichier HTML créé : ${htmlPath}`);
console.log('   Ouvrez ce fichier dans votre navigateur pour faciliter la copie du code\n');


