module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { 
        allowConstantExport: true, 
        allowExportNames: ['AuthContext', 'AuthContextType', 'AuthProvider'] 
      },
    ],
    '@typescript-eslint/no-explicit-any': 'warn', // Passer en 'warn' au lieu de 'error' temporairement
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'prefer-const': 'warn',
    'no-empty-pattern': 'warn',
  },
}

