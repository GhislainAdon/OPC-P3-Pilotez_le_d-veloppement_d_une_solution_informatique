// ***********************************************************
// Commandes Cypress personnalisées — DataShare E2E
// ***********************************************************

Cypress.Commands.add('uploadFile', (selector, fileName, fileContent, mimeType) => {
  cy.get(selector).then($input => {
    const blob = new Blob([fileContent], { type: mimeType });
    const file = new File([blob], fileName, { type: mimeType });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    $input[0].files = dataTransfer.files;
    $input[0].dispatchEvent(new Event('change', { bubbles: true }));
  });
});
