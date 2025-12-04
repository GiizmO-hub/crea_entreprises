import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: join(__dirname, '..', '.env.local') });
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Essayer d'utiliser la clé service_role si disponible, sinon utiliser la clé anonyme
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement Supabase manquantes');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY ou VITE_SUPABASE_ANON_KEY:', supabaseKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testGenerateFichePaie() {
  try {
    console.log('🔄 Test de génération automatique d\'une fiche de paie...\n');

    // 1. Récupérer ou créer une entreprise
    let entreprise = null;
    const { data: entreprises, error: errEntreprises } = await supabase
      .from('entreprises')
      .select('id, nom')
      .limit(1);

    if (errEntreprises) {
      console.warn(`⚠️  Erreur recherche entreprise: ${errEntreprises.message}`);
    }

    if (entreprises && entreprises.length > 0) {
      entreprise = entreprises[0];
      console.log(`✅ Entreprise trouvée: ${entreprise.nom} (${entreprise.id})`);
    } else {
      // Créer une entreprise de test
      console.log('🔄 Création d\'une entreprise de test...');
      
      // Récupérer le premier utilisateur depuis auth.users via RPC ou créer sans user_id
      const { data: newEntreprise, error: errNewEntreprise } = await supabase
        .from('entreprises')
        .insert({
          nom: 'ENTREPRISE TEST FICHE DE PAIE',
          siret: '12345678901234',
          adresse: '123 Rue de Test',
          code_postal: '75001',
          ville: 'Paris',
          email: 'test@example.com',
          telephone: '0123456789',
          // user_id sera null si RLS le permet, sinon on utilisera une RPC function
        })
        .select('id, nom')
        .single();

      if (errNewEntreprise) {
        // Si l'insertion échoue à cause de RLS, essayer via RPC
        console.log('⚠️  Insertion directe échouée, tentative via RPC...');
        const { data: rpcResult, error: rpcError } = await supabase.rpc('create_test_entreprise');
        
        if (rpcError || !rpcResult) {
          // Dernière tentative : utiliser la première entreprise trouvée même si vide
          throw new Error(`Impossible de créer une entreprise. Veuillez créer une entreprise depuis l'application d'abord.\nErreur: ${errNewEntreprise.message || rpcError?.message}`);
        }
        
        entreprise = { id: rpcResult.id, nom: rpcResult.nom };
        console.log(`✅ Entreprise créée via RPC: ${entreprise.nom} (${entreprise.id})`);
      } else {
        entreprise = newEntreprise;
        console.log(`✅ Entreprise créée: ${entreprise.nom} (${entreprise.id})`);
      }
    }

    // 2. Récupérer ou créer un collaborateur
    let collaborateur = null;
    const { data: collaborateurs, error: errCollab } = await supabase
      .from('collaborateurs_entreprise')
      .select('id, nom, prenom, email')
      .eq('entreprise_id', entreprise.id)
      .limit(1);

    if (errCollab) {
      throw new Error(`Erreur recherche collaborateur: ${errCollab.message}`);
    }

    if (collaborateurs && collaborateurs.length > 0) {
      collaborateur = collaborateurs[0];
      console.log(`✅ Collaborateur trouvé: ${collaborateur.prenom} ${collaborateur.nom} (${collaborateur.id})`);
    } else {
      // Créer un collaborateur de test
      console.log('🔄 Création d\'un collaborateur de test...');
      
      const { data: newCollab, error: errNewCollab } = await supabase
        .from('collaborateurs_entreprise')
        .insert({
          entreprise_id: entreprise.id,
          nom: 'Dupont',
          prenom: 'Jean',
          email: 'jean.dupont@test.fr',
          telephone: '0612345678',
          role: 'Développeur',
          date_embauche: new Date().toISOString().split('T')[0],
        })
        .select('id, nom, prenom, email')
        .single();

      if (errNewCollab || !newCollab) {
        throw new Error(`Erreur création collaborateur: ${errNewCollab?.message || 'Erreur inconnue'}`);
      }

      collaborateur = newCollab;
      console.log(`✅ Collaborateur de test créé: ${collaborateur.prenom} ${collaborateur.nom} (${collaborateur.id})`);
    }

    // 3. Trouver ou créer un salary
    let salaryId = null;
    const { data: existingSalary } = await supabase
      .from('salaries')
      .select('id')
      .eq('entreprise_id', entreprise.id)
      .eq('nom', collaborateur.nom)
      .eq('prenom', collaborateur.prenom)
      .maybeSingle();

    if (existingSalary) {
      salaryId = existingSalary.id;
      console.log(`✅ Salary existant trouvé: ${salaryId}`);
    } else {
      const { data: newSalary, error: errSalary } = await supabase
        .from('salaries')
        .insert({
          entreprise_id: entreprise.id,
          nom: collaborateur.nom,
          prenom: collaborateur.prenom,
          email: collaborateur.email || `${collaborateur.prenom.toLowerCase()}.${collaborateur.nom.toLowerCase()}@test.fr`,
          salaire_brut: 2500,
          type_contrat: 'CDI',
          statut: 'actif',
          date_embauche: new Date().toISOString().split('T')[0],
        })
        .select('id')
        .single();

      if (errSalary || !newSalary) {
        throw new Error(`Erreur création salary: ${errSalary?.message || 'Erreur inconnue'}`);
      }

      salaryId = newSalary.id;
      console.log(`✅ Nouveau salary créé: ${salaryId}`);
    }

    // 4. Charger les rubriques par défaut
    const { data: rubriques, error: errRubriques } = await supabase
      .from('rubriques_paie')
      .select('*')
      .eq('par_defaut_active', true)
      .order('ordre_affichage', { ascending: true });

    if (errRubriques) {
      throw new Error(`Erreur chargement rubriques: ${errRubriques.message}`);
    }

    if (!rubriques || rubriques.length === 0) {
      console.warn('⚠️  Aucune rubrique par défaut trouvée. La fiche sera créée sans lignes.');
    } else {
      console.log(`✅ ${rubriques.length} rubriques par défaut trouvées`);
    }

    // 5. Créer la fiche de paie
    const salaireBrut = 2500;
    const periodeDate = new Date();
    const periodeDebut = new Date(periodeDate.getFullYear(), periodeDate.getMonth(), 1).toISOString().split('T')[0];
    const periodeFin = new Date(periodeDate.getFullYear(), periodeDate.getMonth() + 1, 0).toISOString().split('T')[0];
    const numero = `FDP-TEST-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const { data: nouvelleFiche, error: errFiche } = await supabase
      .from('fiches_paie')
      .insert({
        entreprise_id: entreprise.id,
        collaborateur_id: collaborateur.id,
        salary_id: salaryId,
        periode_debut: periodeDebut,
        periode_fin: periodeFin,
        salaire_brut: salaireBrut,
        net_a_payer: salaireBrut * 0.78, // Estimation simplifiée
        numero: numero,
        mois: periodeDate.getMonth() + 1,
        annee: periodeDate.getFullYear(),
        statut: 'brouillon',
      })
      .select('id')
      .single();

    if (errFiche || !nouvelleFiche) {
      throw new Error(`Erreur création fiche de paie: ${errFiche?.message || 'Erreur inconnue'}`);
    }

    console.log(`✅ Fiche de paie créée: ${numero} (${nouvelleFiche.id})`);

    // 6. Créer les lignes par défaut
    if (rubriques && rubriques.length > 0) {
      const lignesParDefaut = rubriques.map((rubrique, index) => {
        let base = salaireBrut;
        let tauxSalarial = 0;
        let tauxPatronal = 0;
        let montantAPayer = 0;

        // Valeurs par défaut selon le code de la rubrique
        switch (rubrique.code) {
          case 'SAL_BASE':
            montantAPayer = salaireBrut;
            break;
          case 'SS_MALADIE_SAL':
            tauxSalarial = 0.75;
            break;
          case 'SS_VIEIL_PLAF_SAL':
            tauxSalarial = 0.6;
            break;
          case 'SS_VIEIL_DEPLAF_SAL':
            tauxSalarial = 0.4;
            break;
          case 'ASS_CHOMAGE_SAL':
            tauxSalarial = 2.4;
            break;
          case 'RET_COMPL_SAL':
            tauxSalarial = 3.15;
            break;
          case 'CSG_DED':
            tauxSalarial = 5.25;
            break;
          case 'CSG_NON_DED':
            tauxSalarial = 2.9;
            break;
          case 'SS_MALADIE_PAT':
            tauxPatronal = 7;
            break;
          case 'SS_VIEIL_PLAF_PAT':
            tauxPatronal = 8.55;
            break;
          case 'SS_VIEIL_DEPLAF_PAT':
            tauxPatronal = 1.9;
            break;
          case 'ALLOC_FAM_PAT':
            tauxPatronal = 3.45;
            break;
          case 'AT_MP_PAT':
            tauxPatronal = 1.5;
            break;
          case 'ASS_CHOMAGE_PAT':
            tauxPatronal = 4.05;
            break;
          case 'RET_COMPL_PAT':
            tauxPatronal = 4.72;
            break;
        }

        const montantSalarial = tauxSalarial ? -(base * tauxSalarial) / 100 : null;
        const montantPatronal = tauxPatronal ? (base * tauxPatronal) / 100 : null;

        return {
          fiche_paie_id: nouvelleFiche.id,
          rubrique_id: rubrique.id,
          libelle_affiche: rubrique.libelle,
          base: base,
          taux_salarial: tauxSalarial || null,
          montant_salarial: montantSalarial,
          taux_patronal: tauxPatronal || null,
          montant_patronal: montantPatronal,
          montant_a_payer: montantAPayer || null,
          ordre_affichage: index + 1,
          groupe_affichage: rubrique.groupe_affichage || 'autre',
        };
      });

      // Calculer le net à payer
      const totalCotisationsSalariales = lignesParDefaut
        .filter(l => l.montant_salarial && l.montant_salarial < 0)
        .reduce((sum, l) => sum + Math.abs(l.montant_salarial || 0), 0);
      
      const ligneNetAPayer = lignesParDefaut.find(l => 
        rubriques.find(r => r.id === l.rubrique_id && r.code === 'NET_A_PAYER')
      );
      if (ligneNetAPayer) {
        ligneNetAPayer.montant_a_payer = salaireBrut - totalCotisationsSalariales;
      }

      const { error: errLignes } = await supabase
        .from('fiches_paie_lignes')
        .insert(lignesParDefaut);

      if (errLignes) {
        console.warn(`⚠️  Erreur création lignes: ${errLignes.message}`);
      } else {
        console.log(`✅ ${lignesParDefaut.length} lignes créées`);
      }

      // Recalculer les totaux
      const totalCotisationsPatronales = lignesParDefaut
        .filter(l => l.montant_patronal && l.montant_patronal > 0)
        .reduce((sum, l) => sum + (l.montant_patronal || 0), 0);

      const netAPayer = ligneNetAPayer?.montant_a_payer || (salaireBrut - totalCotisationsSalariales);
      const coutTotalEmployeur = salaireBrut + totalCotisationsPatronales;

      await supabase
        .from('fiches_paie')
        .update({
          total_cotisations_salariales: totalCotisationsSalariales,
          total_cotisations_patronales: totalCotisationsPatronales,
          net_imposable: netAPayer,
          net_a_payer: netAPayer,
          cout_total_employeur: coutTotalEmployeur,
        })
        .eq('id', nouvelleFiche.id);

      console.log(`✅ Totaux recalculés:`);
      console.log(`   - Cotisations salariales: ${totalCotisationsSalariales.toFixed(2)}€`);
      console.log(`   - Cotisations patronales: ${totalCotisationsPatronales.toFixed(2)}€`);
      console.log(`   - Net à payer: ${netAPayer.toFixed(2)}€`);
      console.log(`   - Coût total employeur: ${coutTotalEmployeur.toFixed(2)}€`);
    }

    console.log('\n✅ Test terminé avec succès !');
    console.log(`\n📋 Résumé:`);
    console.log(`   - Fiche de paie: ${numero}`);
    console.log(`   - Collaborateur: ${collaborateur.prenom} ${collaborateur.nom}`);
    console.log(`   - Salaire brut: ${salaireBrut}€`);
    console.log(`   - Période: ${periodeDebut} → ${periodeFin}`);
    console.log(`\n💡 Tu peux maintenant ouvrir l'application et modifier cette fiche de paie !`);

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  }
}

testGenerateFichePaie();

