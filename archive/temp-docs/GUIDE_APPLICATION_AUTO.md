
# Application Automatique de la Migration

## Limitations

L'API REST Supabase ne permet **pas** l'exécution SQL directe pour des raisons de sécurité.

## Solutions disponibles

### Option 1 : Application manuelle (RECOMMANDÉ)
1. Ouvrez : https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new
2. Copiez le contenu de `APPLY_LAST_MIGRATION_NOW.sql`
3. Collez et exécutez

### Option 2 : Via Supabase CLI (si configuré)
```bash
npx supabase db push
```

### Option 3 : Via psql (si credentials disponibles)
```bash
psql -h db.ewlozuwvrteopotfizcr.supabase.co -U postgres -d postgres -f APPLY_LAST_MIGRATION_NOW.sql
```

## Contenu de la migration

La migration corrige :
1. Retire `statut_paiement` de l'INSERT INTO factures (colonne n'existe pas)
2. Récupère `entreprise_id` depuis les notes si NULL
3. Teste automatiquement le workflow après application
