# Rapport de correction final — Branche `solution`

**Date** : 21 juin 2026
**Auteur** : Ghislain Adon
**Branche** : `solution` (commit après merge de `solution1` + corrections complémentaires)
**Repo** : `GhislainAdon/OPC-P3-Pilotez_le_d-veloppement_d_une_solution_informatique`

Ce rapport liste l'ensemble des corrections apportées suite à l'évaluation de la soutenance, avec pour chacune **l'emplacement exact dans le repo** pour vérification.

---

## 1. Sécurité backend (compétence 7)

### 1.1 Validation des fichiers côté backend
- **Fichier** : `backend/src/main/java/com/datashare/backend/service/FileValidationService.java`
- **Mécanisme** : liste blanche d'extensions + détection du type MIME réel par Apache Tika (analyse du contenu binaire)
- **Test** : `backend/src/test/java/com/datashare/backend/service/FileValidationServiceTest.java` (19 tests)

### 1.2 Détection magic bytes d'exécutable (NOUVEAU — corrige le scénario de la soutenance)
- **Fichier** : `backend/src/main/java/com/datashare/backend/service/FileValidationService.java` (méthode `checkExecutableMagicBytes`)
- **Mécanisme** : analyse des premiers octets du fichier pour détecter les signatures PE Windows (MZ), ELF Linux, Java class (CAFEBABE), Mach-O macOS. Cette vérification s'applique **même si l'extension est en liste blanche** (.txt, .png), ce qui bloque définitivement un `.exe` renommé en `.txt` (scénario QuicSFV.txt de la soutenance).
- **Tests** :
  - `validateExeRenamedAsTxt_rejectedByMagicBytes` — reproduit exactement le scénario de la soutenance
  - `validateExeRenamedAsPng_rejectedByContentDetection` — .exe renommé en .png

### 1.3 Type MIME réel par Apache Tika (au lieu de `file.getContentType()`)
- **Dépendance** : `pom.xml` → `org.apache.tika:tika-core:2.9.2`
- **Fichier** : `FileValidationService.validateAndDetectMimeType()` utilise `tika.detect(is, originalName)`
- **Stockage** : `FileMetadataService.java` persiste `detectedMimeType` (Tika) et non plus `file.getContentType()` (client)

### 1.4 CORS restrictif (avec support Codespaces)
- **Fichier** : `backend/src/main/resources/application.properties`
  ```properties
  cors.allowed-origins=${CORS_ALLOWED_ORIGINS:http://localhost:80,http://localhost:4200,http://localhost,https://*.app.github.dev}
  ```
  - 3 origines locales exactes + 1 pattern pour GitHub Codespaces (`https://*.app.github.dev`)
  - Exemple URL Codespaces : `https://bookish-space-pancake-656x7q7p77f4gjw-80.app.github.dev/`
- **Fichier** : `backend/src/main/java/com/datashare/backend/security/SecurityConfiguration.java`
  - Séparation `setAllowedOrigins` (origines exactes) vs `setAllowedOriginPatterns` (wildcards)
  - Plus de `allowedOriginPatterns("*")` + credentials (faille OWASP corrigée)

### 1.5 Exception handler sécurisé
- **Fichier** : `backend/src/main/java/com/datashare/backend/exception/GlobalExceptionHandler.java`
- **Mécanisme** : les exceptions génériques ne renvoient plus `ex.getMessage()` brut, mais un message générique contrôlé. Handlers dédiés pour `AppException`, `ResourceNotFoundException`, `UnauthorizedException`, `MaxUploadSizeExceededException` (413).

### 1.6 Code 201 Created pour l'upload
- **Fichier** : `backend/src/main/java/com/datashare/backend/controller/FileController.java`
- **Ligne** : `return ResponseEntity.status(HttpStatus.CREATED).body(response);`

### 1.7 Défense path traversal
- **Fichier** : `backend/src/main/java/com/datashare/backend/service/FileStorageService.java`
- **Mécanisme** : `filePath.startsWith(fileStorageLocation)` dans `loadFileAsResource` et `deletePhysicalFile`

---

## 2. Tests (compétence 5)

### 2.1 Couverture JaCoCo backend (seuil bloquant 70 %)
- **Configuration** : `backend/pom.xml` → plugin `jacoco-maven-plugin:0.8.12` avec `<minimum>0.70</minimum>`
- **Résultat** : **78,47 %** (2 005 / 2 555 instructions)
- **Rapport HTML** : généré dans `backend/target/site/jacoco/index.html` après `mvn verify`
- **Statut** : 66 tests, 0 échec, 5 skipped (Testcontainers sans Docker)

### 2.2 Tests FileController cas erreur/sécurité
- **Fichier** : `backend/src/test/java/com/datashare/backend/controller/FileControllerTest.java`
- **Tests ajoutés** :
  - `uploadFile_ExeRejected_Returns400`
  - `uploadFile_TooLarge_Returns413`
  - `uploadFile_MismatchedMime_Returns400`
  - `downloadFile_NotFound_Returns404`
  - `downloadFile_PasswordMissing_Returns401`
  - `downloadFile_Expired_Returns410`
  - `deleteFile_NotOwner_Returns401`

### 2.3 Rapport Vitest frontend (configuré, exécuté, documenté)
- **Configuration** : `frontend/vitest.config.ts`
  - Provider : `@vitest/coverage-v8`
  - Reporters : `text`, `text-summary`, `html`, `lcov`, `json-summary`
  - Seuils bloquants : lines/branches/stmts ≥ 70 %, functions ≥ 60 %
- **Configuration Angular** : `frontend/angular.json` (section `architect.test.options` avec `coverage: true`)
- **Emplacement du rapport** : `frontend/coverage/` (généré après `npm test -- --watch=false`)
  - **Note** : ce répertoire est en `.gitignore` car c'est un artefact de build (comme `target/` pour Maven). On ne commit pas les fichiers générés, ils sont régénérés à chaque exécution. Le rapport HTML est consultable localement dans `frontend/coverage/index.html`.
- **Résultat** : 34 tests, 0 échec
  - Statements : 75,78 % (seuil 70 %) ✓
  - Branches : 73,73 % (seuil 70 %) ✓
  - Functions : 61,79 % (seuil 60 %) ✓
  - Lines : 80,23 % (seuil 70 %) ✓
- **Documentation** : `TESTING.md` section « Tests Frontend (Angular 22 / Vitest) »

### 2.4 Testcontainers PostgreSQL (NOUVEAU)
- **Dépendances** : `backend/pom.xml`
  - `org.testcontainers:testcontainers:1.20.4`
  - `org.testcontainers:postgresql:1.20.4`
  - `org.testcontainers:junit-jupiter:1.20.4`
  - `org.springframework.boot:spring-boot-testcontainers` (scope test)
- **Fichier** : `backend/src/test/java/com/datashare/backend/integration/PostgresIntegrationTest.java`
- **Tests** (5 au total) :
  - `userRepository_canPersistAndFindByEmail`
  - `fileMetadataRepository_canPersistWithAllFields`
  - `fileMetadataRepository_returnsEmptyForUnknownUuid`
  - `userRepository_enforcesUniqueEmail` (contrainte SQL réelle PostgreSQL)
  - `fileMetadataRepository_canQueryByExpiryStatus`
- **Activation** : `@EnabledIfSystemProperty(named = "docker.available", matches = "true")` — les tests sont désactivés par défaut pour ne pas casser le build sur les environnements sans Docker. Pour les exécuter : `mvn test -Dtest=PostgresIntegrationTest -Ddocker.available=true` (Docker doit être démarré)
- **Conteneur** : `postgres:16-alpine` via `@ServiceConnection` (configuration automatique de la datasource)

### 2.5 Scénario E2E Cypress réel
- **Fichiers** :
  - `tests/e2e/cypress/e2e/upload-download.cy.js` (3 scénarios)
  - `tests/e2e/cypress.config.js`
  - `tests/e2e/package.json`
  - `tests/e2e/cypress/support/commands.js`
  - `tests/e2e/cypress/support/e2e.js`
- **Scénarios** : upload anonyme → téléchargement + vérification magic bytes PNG ; rejet .exe frontend ; rejet .exe backend

### 2.6 Test de charge k6 exécuté
- **Fichier** : `tests/load/load-test.js`
- **Résultats capturés** (exécution du 21/06/2026) :
  - 1 977 requêtes en 30 s avec 20 VUs
  - Taux : 64,98 req/s
  - p(95) : 6,02 ms (seuil SLA 500 ms) ✓
  - 1 581 downloads, 316 uploads, 96 auth registers
- **Fichiers de résultats** : `tests/load/k6-results.txt` (dans le repo), `k6-results-final.json` (artefact)

---

## 3. Cohérence documentation / code

### 3.1 SECURITY.md
- **Fichier** : `SECURITY.md` — entièrement réécrit pour refléter l'implémentation réelle (4 piliers défensifs, CORS restrictif, path traversal, exception handler, tableau Avant/Après)

### 3.2 TESTING.md
- **Fichier** : `TESTING.md` — résultats d'exécution réels (78,47 % JaCoCo, 75,78 % Vitest, k6 p95=6,02 ms), tableau de conformité aux exigences du mentor

### 3.3 README.md
- **Fichier** : `README.md` — liens `file:///c:/Users/...` remplacés par chemins relatifs

---

## 4. API et livrables

### 4.1 Spécification OpenAPI 3.0
- **Fichier** : `backend/src/main/resources/static/openapi.yaml`
- **URL** : servie sur `/openapi.yaml` par Spring Boot (ressource statique)
- **Contenu** : 7 endpoints, 5 schémas, codes d'erreur 400/401/403/404/410/413, auth bearerAuth JWT

### 4.2 Script backup-db.sh
- **Fichier** : `backup-db.sh` (à la racine du dépôt, exécutable)
- **Mécanisme** : pg_dump + gzip + purge automatique des sauvegardes > 30 jours

---

## 5. Accessibilité et conformité RGPD

### 5.1 Attributs ARIA
- **Fichier** : `frontend/src/app/components/upload.component.ts`
- **42 attributs ARIA** : `role`, `aria-label`, `aria-live`, `aria-describedby`, `aria-valuenow/min/max`, `aria-hidden`, `aria-disabled`, `aria-current`, `aria-atomic`
- **Classe utilitaire** : `.sr-only` pour lecteurs d'écran

### 5.2 Politique de confidentialité RGPD
- **Composant frontend** : `frontend/src/app/components/privacy.component.ts` (page dédiée)
- **Formulaire register** : champ `privacyConsent` avec `Validators.requiredTrue` dans `register.component.ts`
- **Documentation Word** : section 6.2 « Politique de confidentialité et RGPD » (email, mot de passe BCrypt, durée conservation 7 jours max, droits RGPD, suppression compte)

---

## 6. Documentation Word

- **Fichier** : `Adon_Ghislain_1_documentation.docx` (à la racine du dépôt)
- **Contenu** : 7 sections (résumé exécutif, sécurité backend, tests, cohérence doc, API/livrables, accessibilité/RGPD, conclusion), tableaux de rapports de tests intégrés, TOC clickable

---

## 7. Récapitulatif des emplacements pour vérification

| Élément | Emplacement dans le repo |
|---|---|
| FileValidationService (Tika + magic bytes) | `backend/src/main/java/com/datashare/backend/service/FileValidationService.java` |
| FileController (201 Created) | `backend/src/main/java/com/datashare/backend/controller/FileController.java` |
| SecurityConfiguration (CORS restrictif) | `backend/src/main/java/com/datashare/backend/security/SecurityConfiguration.java` |
| GlobalExceptionHandler (sécurisé) | `backend/src/main/java/com/datashare/backend/exception/GlobalExceptionHandler.java` |
| FileStorageService (path traversal) | `backend/src/main/java/com/datashare/backend/service/FileStorageService.java` |
| Config CORS (application.properties) | `backend/src/main/resources/application.properties` |
| Config JaCoCo (pom.xml) | `backend/pom.xml` |
| Spec OpenAPI | `backend/src/main/resources/static/openapi.yaml` |
| Tests backend (66 tests) | `backend/src/test/java/com/datashare/backend/**` |
| Tests Testcontainers PostgreSQL | `backend/src/test/java/com/datashare/backend/integration/PostgresIntegrationTest.java` |
| Config Vitest | `frontend/vitest.config.ts` + `frontend/angular.json` |
| Rapport Vitest (généré, en .gitignore) | `frontend/coverage/index.html` |
| Attributs ARIA | `frontend/src/app/components/upload.component.ts` |
| Composant RGPD | `frontend/src/app/components/privacy.component.ts` |
| Scénario E2E Cypress | `tests/e2e/cypress/e2e/upload-download.cy.js` |
| Script k6 | `tests/load/load-test.js` |
| Résultats k6 | `tests/load/k6-results.txt` |
| Script backup-db.sh | `backup-db.sh` |
| Doc Word | `Adon_Ghislain_1_documentation.docx` |
| SECURITY.md | `SECURITY.md` |
| TESTING.md | `TESTING.md` |
| README.md (liens corrigés) | `README.md` |

---

## 8. Commandes de vérification

```bash
# Cloner la branche solution
git clone -b solution https://github.com/GhislainAdon/OPC-P3-Pilotez_le_d-veloppement_d_une_solution_informatique.git
cd OPC-P3-Pilotez_le_d-veloppement_d_une_solution_informatique

# Backend : tests + couverture JaCoCo
cd backend
mvn clean verify
# → 66 tests, 0 échec, 5 skipped (Testcontainers), couverture 78,47 %
# Rapport HTML : target/site/jacoco/index.html

# Backend : tests Testcontainers (nécessite Docker)
mvn test -Dtest=PostgresIntegrationTest -Ddocker.available=true
# → 5 tests PostgreSQL réels

# Frontend : tests + couverture Vitest
cd ../frontend
npm install
npm test -- --watch=false
# → 34 tests, 0 échec
# Rapport HTML : coverage/index.html

# Test de charge k6 (nécessite backend démarré sur :8080)
cd ..
k6 run --vus 20 --duration 30s tests/load/load-test.js
# → p(95) < 10 ms

# Spec OpenAPI (nécessite backend démarré)
curl http://localhost:8080/openapi.yaml

# Vérifier qu'aucun lien file:///c:/ ne subsiste dans README
grep -c "file:///" README.md  # doit renvoyer 0
```

---

## 9. Statut final par exigence du mentor

| Exigence du mentor | Statut | Preuve |
|---|---|---|
| Validation fichiers backend absente | ✅ Corrigé | `FileValidationService.java` + magic bytes |
| Type MIME non détecté (falsifiable) | ✅ Corrigé | Apache Tika sur contenu binaire |
| CORS ouvert à toutes origines | ✅ Corrigé | Liste stricte + pattern Codespaces |
| Exception brute renvoyée au client | ✅ Corrigé | `GlobalExceptionHandler` message générique |
| Upload renvoie 200 au lieu de 201 | ✅ Corrigé | `ResponseEntity.status(HttpStatus.CREATED)` |
| Pas de mesure de couverture | ✅ Corrigé | JaCoCo 78,47 % + Vitest 75,78 % |
| Tests FileController tous nominaux | ✅ Corrigé | 7 tests cas erreur/sécurité |
| E2E Cypress non implémentés | ✅ Corrigé | `tests/e2e/cypress/e2e/upload-download.cy.js` |
| Test de charge k6 non exécuté | ✅ Corrigé | `tests/load/load-test.js` exécuté, p95=6,02 ms |
| Tests d'intégration sur H2, pas PostgreSQL | ✅ Corrigé | `PostgresIntegrationTest.java` (Testcontainers) |
| Pas d'OpenAPI réel | ✅ Corrigé | `backend/src/main/resources/static/openapi.yaml` |
| backup-db.sh absent du dépôt | ✅ Corrigé | `backup-db.sh` à la racine |
| Liens locaux cassés dans README | ✅ Corrigé | Chemins relatifs |
| Attributs ARIA / accessibilité | ✅ Corrigé | 42 attributs ARIA dans `upload.component.ts` |
| Politique de confidentialité | ✅ Corrigé | `privacy.component.ts` + section RGPD doc Word |

**Tous les axes d'amélioration identifiés par le mentor sont corrigés.**

---

## 10. Note sur la suppression de la branche solution1

La branche `solution1` a été créée initialement pour développer les corrections. Une fois le merge effectué sur `solution` par Ghislain, la branche `solution1` est devenue obsolète et sera supprimée après push des derniers commits complémentaires (CORS Codespaces, magic bytes, Testcontainers, rapport Vitest).

Pour vérifier que `solution1` est bien mergée dans `solution` :
```bash
git branch --merged solution | grep solution1
```

---

**Fin du rapport de correction.**
