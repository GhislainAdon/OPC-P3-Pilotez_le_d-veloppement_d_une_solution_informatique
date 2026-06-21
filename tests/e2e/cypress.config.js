import { defineConfig } from 'cypress';

/**
 * Configuration Cypress pour les tests E2E de DataShare.
 *
 * Pré-requis : backend sur http://localhost:8080 et frontend sur http://localhost:4200.
 *
 * Exécution :
 *   cd tests/e2e
 *   npm install
 *   npx cypress run          # headless
 *   npx cypress open         # interactif
 */
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
    specPattern: 'cypress/e2e/**/*.cy.{js,ts}',
    supportFile: 'cypress/support/e2e.js',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 15000,
    requestTimeout: 30000,
    responseTimeout: 30000,
    setupNodeEvents(on, config) {
      // Plugin placeholder : on peut ajouter ici des tasks personnalisées
      // (ex: nettoyage de la base de test avant chaque run).
      return config;
    },
  },
  env: {
    BACKEND_URL: 'http://localhost:8080',
  },
});
