import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Séparer les node_modules en chunks distincts
          if (id.includes('node_modules')) {
            // Bibliothèques PDF et canvas (grosses dépendances)
            if (id.includes('jspdf') || id.includes('html2canvas')) {
              return 'vendor-pdf';
            }
            
            // Supabase client
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            
            // React et React DOM
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            
            // Lucide icons (peut être volumineux)
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            
            // Autres dépendances
            return 'vendor-other';
          }
          
          // Regrouper les pages par taille/catégorie
          if (id.includes('/src/pages/')) {
            // Pages les plus volumineuses (isolées)
            if (id.includes('GestionEquipe')) {
              return 'pages-gestion-equipe';
            }
            if (id.includes('Factures')) {
              return 'pages-factures';
            }
            if (id.includes('Documents')) {
              return 'pages-documents';
            }
            
            // Pages moyennes (regroupées)
            if (id.includes('Abonnements') || id.includes('Collaborateurs')) {
              return 'pages-management';
            }
            
            // Pages plus petites (regroupées)
            return 'pages-core';
          }
          
          // Regrouper les composants
          if (id.includes('/src/components/')) {
            return 'components';
          }
          
          // Regrouper les libs/utils
          if (id.includes('/src/lib/')) {
            return 'lib';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600, // Augmenter la limite pour les gros chunks (en KB)
  },
})
