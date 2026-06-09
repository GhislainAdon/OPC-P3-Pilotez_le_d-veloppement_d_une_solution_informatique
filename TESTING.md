# Plan de Suivi de Qualité — Testing

Le plan de test de DataShare a été élaboré pour assurer 100% de fiabilité sur les cas d'utilisation critiques de l'application (l'authentification, le dépôt sécurisé de fichiers, la validation des formats et des tailles de fichiers, le téléchargement sous condition de mot de passe, et le nettoyage automatique des fichiers expirés).

---

## 🎯 Stratégie Globale de Test

L'application suit une pyramide de tests stricte composée de :
1. **Tests Unitaires Backend** (Services métiers indépendants).
2. **Tests d'Intégration Backend** (Controllers REST, filtres de sécurité JWT, persistance Hibernate/PostgreSQL).
3. **Tests Unitaires Frontend** (Services Angular, gestion d'état par Signals, formulaires réactifs et logique des composants).
4. **Tests de Bout-en-Bout (E2E)** (Simulation des parcours utilisateurs).

---

## ☕ Tests Backend (Spring Boot 4 / JUnit 5)

La suite de tests backend comporte **32 tests** qui couvrent l'intégralité du code métier.

### Composants Testés
- **`AuthControllerTest`** (2 tests) : Validation de l'enregistrement de nouveaux comptes et de la connexion (génération correcte des tokens JWT).
- **`FileControllerTest`** (6 tests) :
  - Dépôt de fichiers autorisés (anonyme ou authentifié).
  - Rejet des fichiers exécutables (.exe, .bat, etc.) et des dépassements de taille.
  - Récupération sécurisée des métadonnées.
  - Téléchargement de fichiers avec et sans mot de passe.
  - Suppression de fichiers par le propriétaire.
- **`AuthServiceTest`** (5 tests) : Logique de hachage de mot de passe et génération des claims JWT.
- **`FileMetadataServiceTest`** (12 tests) : Gestion du cycle de vie des métadonnées, gestion de l'expiration, tags, et la tâche planifiée de nettoyage automatique.
- **`FileStorageServiceTest`** (6 tests) : Création des répertoires physiques, écriture sécurisée sur le disque, renommage avec UUID, et suppression physique des fichiers.

### Innovations de Tests (Spring Boot 4 & Spring Security 7)
- **MockitoBean** : Remplacement des anciennes annotations `@MockBean` par `@MockitoBean` (standardisé sous Spring Boot 4).
- **Jackson v3** : Les sérialisations JSON dans les tests d'intégration utilisent `tools.jackson.databind.ObjectMapper`.
- **Stateless JWT Injection** : Afin d'éviter les faux-positifs liés aux sessions stateless, le `FileControllerTest` utilise l'injection de véritables tokens JWT générés à la volée dans les en-têtes HTTP de MockMvc.

### Commande d'exécution
```bash
cd backend
mvn clean test
```

---

## 🅰️ Tests Frontend (Angular 22 / Vitest)

La suite de tests frontend comporte **34 tests unitaires** qui s'exécutent avec le nouveau framework natif de tests unitaires d'Angular 22.

### Composants & Services Testés
- **`App` Component** (2 tests) : Cycle de vie de l'application.
- **`AuthService`** (4 tests) : Enregistrement, connexion, persistance du token dans localStorage, deconnexion.
- **`FileService`** (6 tests) : Gestion des requêtes multipart (upload), téléchargement de blobs binaires, historisation, et appel d'API de suppression.
- **`LoginComponent` & `RegisterComponent`** (8 tests) : Validation des formulaires réactifs (regex d'emails, longueur minimale de mot de passe) et gestion des erreurs de requêtes.
- **`UploadComponent`** (5 tests) :
  - Drag and drop d'un fichier.
  - Rejet côté client des formats dangereux (`.exe`, `.bat`, etc.) et fichiers > 1 Go.
  - Mise à jour en temps réel des signaux de progression d'upload.
- **`HistoryComponent`** (4 tests) : Chargement de la liste des partages, conversion des octets en unités lisibles (Ko, Mo, Go), suppression avec confirmation.
- **`DownloadComponent`** (5 tests) :
  - Détection automatique de la protection par mot de passe.
  - Gestion du formulaire de déverrouillage.
  - Téléchargement physique via l'API Blob.

### Commande d'exécution
```bash
cd frontend
# Utiliser Node v22.22.3 ou supérieur
npm run test
```

---

## 🔄 Scénarios Cypress E2E (Planifiés)

Les scénarios E2E automatisés simulent des flux complets :
1. **Flux Privé** : L'utilisateur s'enregistre -> se connecte -> dépose un fichier protégé par mot de passe -> copie le lien généré -> accède au lien en mode anonyme -> saisit le mot de passe -> télécharge le fichier -> retourne sur son dashboard -> supprime le fichier.
2. **Flux Anonyme** : L'utilisateur dépose un fichier sans compte ni mot de passe -> télécharge le fichier via le lien -> vérifie que le fichier expire automatiquement après 7 jours.
