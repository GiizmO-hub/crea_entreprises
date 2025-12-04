import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement (.env.local puis .env)
config({ path: join(__dirname, '..', '.env.local') });
config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeFacture(numero) {
  console.log(`\n🔍 ANALYSE DE LA FACTURE ${numero}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Récupérer la facture
    const { data: facture, error: factureError } = await supabase
      .from('factures')
      .select(`
        *,
        clients:client_id (
          id,
          nom,
          prenom,
          entreprise_nom,
          email,
          telephone,
          adresse,
          code_postal,
          ville
        ),
        entreprises:entreprise_id (
          id,
          nom,
          siret,
          adresse,
          code_postal,
          ville,
          email,
          telephone
        )
      `)
      .eq('numero', numero)
      .single();

    if (factureError || !facture) {
      console.error('❌ Erreur récupération facture:', factureError);
      return;
    }

    console.log('📋 INFORMATIONS GÉNÉRALES');
    console.log('─────────────────────────────────────────────────────────');
    console.log(`Numéro: ${facture.numero}`);
    console.log(`Type: ${facture.type || 'facture'}`);
    console.log(`Statut: ${facture.statut}`);
    console.log(`Date d'émission: ${facture.date_emission || facture.date_facturation || 'N/A'}`);
    console.log(`Date d'échéance: ${facture.date_echeance || 'N/A'}`);
    if (facture.type === 'devis') {
      console.log(`Date de validité: ${facture.date_validite || 'N/A'}`);
    }
    console.log(`Source: ${facture.source || 'N/A'}`);
    console.log(`Montant HT: ${facture.montant_ht?.toFixed(2) || '0.00'} €`);
    console.log(`TVA: ${facture.tva?.toFixed(2) || '0.00'} €`);
    console.log(`Montant TTC: ${facture.montant_ttc?.toFixed(2) || '0.00'} €`);

    // 2. Récupérer les lignes
    const { data: lignes, error: lignesError } = await supabase
      .from('facture_lignes')
      .select('*')
      .eq('facture_id', facture.id)
      .order('ordre');

    if (lignesError) {
      console.error('❌ Erreur récupération lignes:', lignesError);
    } else {
      console.log(`\n📦 LIGNES DE FACTURE (${lignes?.length || 0})`);
      console.log('─────────────────────────────────────────────────────────');
      
      if (!lignes || lignes.length === 0) {
        console.log('⚠️  Aucune ligne trouvée !');
      } else {
        let totalHTCalcule = 0;
        let totalTVACalcule = 0;
        let totalTTCCalcule = 0;

        lignes.forEach((ligne, index) => {
          const montantHT = ligne.montant_ht || (ligne.quantite * ligne.prix_unitaire_ht) || 0;
          const montantTVA = ligne.tva || ligne.montant_tva || (montantHT * (ligne.taux_tva || 20) / 100);
          const montantTTC = ligne.montant_ttc || (montantHT + montantTVA);

          totalHTCalcule += montantHT;
          totalTVACalcule += montantTVA;
          totalTTCCalcule += montantTTC;

          console.log(`\nLigne ${index + 1}:`);
          console.log(`  Description: ${ligne.description || 'N/A'}`);
          console.log(`  Quantité: ${ligne.quantite || 0}`);
          console.log(`  Prix unitaire HT: ${ligne.prix_unitaire_ht?.toFixed(2) || '0.00'} €`);
          console.log(`  Taux TVA: ${ligne.taux_tva || 20}%`);
          console.log(`  Montant HT: ${montantHT.toFixed(2)} €`);
          console.log(`  TVA: ${montantTVA.toFixed(2)} €`);
          console.log(`  Montant TTC: ${montantTTC.toFixed(2)} €`);
        });

        console.log(`\n💰 TOTAUX CALCULÉS DEPUIS LES LIGNES`);
        console.log('─────────────────────────────────────────────────────────');
        console.log(`Total HT: ${totalHTCalcule.toFixed(2)} €`);
        console.log(`Total TVA: ${totalTVACalcule.toFixed(2)} €`);
        console.log(`Total TTC: ${totalTTCCalcule.toFixed(2)} €`);
      }
    }

    // 3. Informations client
    console.log(`\n👤 CLIENT`);
    console.log('─────────────────────────────────────────────────────────');
    if (facture.clients) {
      const client = Array.isArray(facture.clients) ? facture.clients[0] : facture.clients;
      console.log(`Nom: ${client.nom || 'N/A'} ${client.prenom || ''}`);
      console.log(`Entreprise: ${client.entreprise_nom || 'N/A'}`);
      console.log(`Email: ${client.email || 'N/A'}`);
      console.log(`Téléphone: ${client.telephone || 'N/A'}`);
      console.log(`Adresse: ${client.adresse || 'N/A'} ${client.code_postal || ''} ${client.ville || ''}`);
    } else {
      console.log('⚠️  Client non trouvé');
    }

    // 4. Informations entreprise
    console.log(`\n🏢 ENTREPRISE`);
    console.log('─────────────────────────────────────────────────────────');
    if (facture.entreprises) {
      const entreprise = Array.isArray(facture.entreprises) ? facture.entreprises[0] : facture.entreprises;
      console.log(`Nom: ${entreprise.nom || 'N/A'}`);
      console.log(`SIRET: ${entreprise.siret || 'N/A'}`);
      console.log(`Adresse: ${entreprise.adresse || 'N/A'} ${entreprise.code_postal || ''} ${entreprise.ville || ''}`);
      console.log(`Email: ${entreprise.email || 'N/A'}`);
      console.log(`Téléphone: ${entreprise.telephone || 'N/A'}`);
    } else {
      console.log('⚠️  Entreprise non trouvée');
    }

    // 5. Vérifications de cohérence
    console.log(`\n✅ VÉRIFICATIONS DE COHÉRENCE`);
    console.log('─────────────────────────────────────────────────────────');
    
    const issues = [];
    const warnings = [];

    // Vérifier les totaux
    if (lignes && lignes.length > 0) {
      const totalHTLignes = lignes.reduce((sum, l) => sum + (l.montant_ht || (l.quantite * l.prix_unitaire_ht) || 0), 0);
      const totalTVALignes = lignes.reduce((sum, l) => sum + (l.tva || l.montant_tva || 0), 0);
      const totalTTCLignes = lignes.reduce((sum, l) => sum + (l.montant_ttc || 0), 0);

      const diffHT = Math.abs(facture.montant_ht - totalHTLignes);
      const diffTVA = Math.abs((facture.tva || 0) - totalTVALignes);
      const diffTTC = Math.abs(facture.montant_ttc - totalTTCLignes);

      if (diffHT > 0.01) {
        issues.push(`❌ Écart HT: ${facture.montant_ht?.toFixed(2)} € (facture) vs ${totalHTLignes.toFixed(2)} € (lignes) = ${diffHT.toFixed(2)} €`);
      }
      if (diffTVA > 0.01) {
        issues.push(`❌ Écart TVA: ${(facture.tva || 0).toFixed(2)} € (facture) vs ${totalTVALignes.toFixed(2)} € (lignes) = ${diffTVA.toFixed(2)} €`);
      }
      if (diffTTC > 0.01) {
        issues.push(`❌ Écart TTC: ${facture.montant_ttc?.toFixed(2)} € (facture) vs ${totalTTCLignes.toFixed(2)} € (lignes) = ${diffTTC.toFixed(2)} €`);
      }
    } else {
      warnings.push('⚠️  Aucune ligne de facture trouvée');
    }

    // Vérifier les champs obligatoires
    if (!facture.client_id) {
      issues.push('❌ Client manquant (client_id)');
    }
    if (!facture.entreprise_id) {
      issues.push('❌ Entreprise manquante (entreprise_id)');
    }
    if (!facture.numero) {
      issues.push('❌ Numéro manquant');
    }
    if (!facture.date_emission && !facture.date_facturation) {
      warnings.push('⚠️  Date d\'émission manquante');
    }

    // Vérifier la cohérence TTC = HT + TVA
    const ttcCalcule = (facture.montant_ht || 0) + (facture.tva || 0);
    const diffTTC = Math.abs(facture.montant_ttc - ttcCalcule);
    if (diffTTC > 0.01) {
      issues.push(`❌ Incohérence TTC: ${facture.montant_ttc?.toFixed(2)} € ≠ ${ttcCalcule.toFixed(2)} € (HT + TVA)`);
    }

    // Afficher les résultats
    if (issues.length === 0 && warnings.length === 0) {
      console.log('✅ Aucun problème détecté !');
    } else {
      if (issues.length > 0) {
        console.log('\n❌ PROBLÈMES DÉTECTÉS:');
        issues.forEach(issue => console.log(`  ${issue}`));
      }
      if (warnings.length > 0) {
        console.log('\n⚠️  AVERTISSEMENTS:');
        warnings.forEach(warning => console.log(`  ${warning}`));
      }
    }

    // 6. Notes et métadonnées
    if (facture.notes) {
      console.log(`\n📝 NOTES`);
      console.log('─────────────────────────────────────────────────────────');
      console.log(facture.notes);
    }

    // 7. Avis général
    console.log(`\n💡 AVIS GÉNÉRAL`);
    console.log('─────────────────────────────────────────────────────────');
    
    if (issues.length === 0 && warnings.length === 0 && lignes && lignes.length > 0) {
      console.log('✅ Facture complète et cohérente');
      console.log(`   - ${lignes.length} ligne(s) de facture`);
      console.log(`   - Totaux cohérents`);
      console.log(`   - Informations client et entreprise présentes`);
    } else if (issues.length === 0 && warnings.length > 0) {
      console.log('⚠️  Facture globalement correcte mais avec quelques avertissements');
    } else {
      console.log('❌ Facture avec des problèmes à corriger');
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Erreur lors de l\'analyse:', error);
  }
}

// Exécuter l'analyse
const numeroFacture = process.argv[2] || 'FAC-4086';
analyzeFacture(numeroFacture);

