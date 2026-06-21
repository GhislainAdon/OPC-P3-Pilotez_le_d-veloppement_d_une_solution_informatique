/**
 * Scénario E2E Cypress — DataShare
 * ================================
 *
 * Scénario réel de bout en bout : upload anonyme d'un fichier, récupération
 * du lien de téléchargement, puis téléchargement du fichier via ce lien.
 *
 * Ce scénario corrige le manque identifié par le mentor :
 *   "E2E Cypress non implémentés (seulement décrits)"
 *
 * Pré-requis :
 *   - Backend démarré sur http://localhost:8080
 *   - Frontend démarré sur http://localhost:4200 (ng serve)
 *
 * Exécution :
 *   cd tests/e2e
 *   npx cypress run --spec cypress/e2e/upload-download.cy.js
 */

describe('DataShare — Flux E2E : Upload anonyme → Téléchargement', () => {

  const FRONTEND_URL = 'http://localhost:4200';
  const BACKEND_URL = 'http://localhost:8080';

  beforeEach(() => {
    cy.visit(FRONTEND_URL);
  });

  it('permet à un utilisateur anonyme de téléverser un fichier et de le télécharger', () => {
    // === Étape 1 : vérifier que la page d'accueil s'affiche ===
    cy.contains('Glissez-déposez votre fichier ici', { timeout: 10000 })
      .should('be.visible');
    cy.get('span.logo').should('contain', 'DataShare');

    // === Étape 2 : sélectionner un fichier PNG valide via l'input file ===
    // On génère un PNG minimal en mémoire (magic bytes + IHDR)
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, // IHDR length
      0x49, 0x48, 0x44, 0x52, // "IHDR"
      0x00, 0x00, 0x00, 0x01, // width=1
      0x00, 0x00, 0x00, 0x01, // height=1
      0x08, 0x06, 0x00, 0x00, 0x00, // bit depth=8, color type=6
      0x1F, 0x15, 0xC4, 0x89, // CRC
      0x00, 0x00, 0x00, 0x0A, // IDAT length
      0x49, 0x44, 0x41, 0x54, // "IDAT"
      0x78, 0x9C, 0x62, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01,
      0x0D, 0x0A, 0x2D, 0xB4, // CRC
      0x00, 0x00, 0x00, 0x00, // IEND length
      0x49, 0x45, 0x4E, 0x44, // "IEND"
      0xAE, 0x42, 0x60, 0x82, // CRC
    ]);
    const pngBlob = new Blob([pngBytes], { type: 'image/png' });
    const testFile = new File([pngBlob], 'e2e-test.png', { type: 'image/png' });

    // Injecter le fichier dans l'input file via DataTransfer
    cy.get('input[type="file"]').then($input => {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(testFile);
      $input[0].files = dataTransfer.files;
      $input[0].dispatchEvent(new Event('change', { bubbles: true }));
    });

    // === Étape 3 : vérifier que l'upload démarre ===
    cy.contains('Téléversement en cours', { timeout: 5000 }).should('be.visible');

    // === Étape 4 : attendre le succès de l'upload ===
    cy.contains('Fichier prêt à être partagé', { timeout: 30000 }).should('be.visible');
    cy.contains('e2e-test.png').should('be.visible');

    // === Étape 5 : extraire l'UUID du lien généré ===
    cy.get('input.link-input').should('have.value').and('not.be.empty').then($input => {
      const downloadUrl = $input.val();
      const uuidMatch = downloadUrl && downloadUrl.match(/\/download\/([a-f0-9-]+)/i);
      expect(uuidMatch, 'UUID extrait du lien').to.not.be.null;
      const uuid = uuidMatch[1];

      // === Étape 6 : consulter les métadonnées du fichier via l'API ===
      cy.request({
        method: 'GET',
        url: `${BACKEND_URL}/api/files/download/${uuid}/details`,
      }).then(response => {
        expect(response.status).to.eq(200);
        expect(response.body.uuid).to.eq(uuid);
        expect(response.body.originalName).to.eq('e2e-test.png');
        expect(response.body.fileType).to.eq('image/png');
        expect(response.body.isExpired).to.be.false;
      });

      // === Étape 7 : télécharger le fichier via l'API et vérifier le contenu ===
      cy.request({
        method: 'GET',
        url: `${BACKEND_URL}/api/files/download/${uuid}`,
        encoding: 'binary',
      }).then(response => {
        expect(response.status).to.eq(200);
        expect(response.headers['content-disposition'])
          .to.contain('filename="e2e-test.png"');
        // Le corps de la réponse doit commencer par la signature PNG
        const bytes = new Uint8Array(response.body);
        expect(bytes[0]).to.eq(0x89);
        expect(bytes[1]).to.eq(0x50); // 'P'
        expect(bytes[2]).to.eq(0x4E); // 'N'
        expect(bytes[3]).to.eq(0x47); // 'G'
      });
    });
  });

  it('rejette un fichier exécutable côté frontend (validation UX)', () => {
    cy.contains('Glissez-déposez votre fichier ici', { timeout: 10000 }).should('be.visible');

    const exeFile = new File(['MZ fake exe'], 'malware.exe', { type: 'application/x-msdownload' });

    cy.get('input[type="file"]').then($input => {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(exeFile);
      $input[0].files = dataTransfer.files;
      $input[0].dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Le frontend doit afficher un message d'erreur et NE PAS démarrer l'upload
    cy.contains('.exe', { timeout: 5000 }).should('be.visible');
    cy.contains('Téléversement en cours').should('not.exist');
  });

  it('rejette un fichier exécutable côté backend (validation API)', () => {
    // Test direct de l'API : un POST avec un .exe doit retourner 400
    // (et non 201), prouvant que la validation backend est bien en place.
    const formData = new FormData();
    const exeBlob = new Blob(['MZ fake exe'], { type: 'application/x-msdownload' });
    formData.append('file', exeBlob, 'malware.exe');

    cy.request({
      method: 'POST',
      url: `${BACKEND_URL}/api/files/upload`,
      body: formData,
      failOnStatusCode: false, // On s'attend à un 400
    }).then(response => {
      expect(response.status).to.eq(400);
      expect(response.body.message).to.contain('interdits');
    });
  });
});
