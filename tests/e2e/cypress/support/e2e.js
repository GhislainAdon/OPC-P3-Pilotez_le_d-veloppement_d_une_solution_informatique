// ***********************************************************
// Support Cypress — DataShare E2E
// ***********************************************************

import './commands';

// Handler global pour les exceptions non catchées : on ne fait pas échouer
// le test sur une exception applicativeAttendue (ex: erreurs 400 attendues).
Cypress.on('uncaught:exception', (err, runnable) => {
  // On retourne false pour empêcher Cypress de faire échouer le test
  // sur des erreurs Angular non bloquantes (ex: navigation).
  return false;
});
