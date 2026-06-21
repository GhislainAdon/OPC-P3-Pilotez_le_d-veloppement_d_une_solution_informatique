# Plan de Suivi de Qualité — Sécurité

La sécurité est un pilier fondamental de DataShare. En tant qu'application de partage de fichiers, elle s'expose à de multiples vecteurs d'attaque (dépôt de fichiers malveillants, vols de session, fuites de données privées, dénis de service). Ce document formalise les mesures et la politique de sécurité mises en place.

> **Note de révision** : ce document a été aligné sur l'implémentation réelle. Toute affirmation de sécurité décrite ici est désormais vérifiée par des tests automatisés (voir TESTING.md).

---

## 1. Authentification & Autorisation

### Stateless JWT (JSON Web Tokens)
- **Principe** : L'authentification est entièrement sans état (stateless). Aucun identifiant de session n'est stocké côté serveur.
- **Cycle de vie** : Lors d'une connexion réussie (`POST /api/auth/login`), le serveur génère un token JWT signé avec un algorithme HMAC-SHA256 à l'aide d'une clé secrète forte (minimum 256 bits).
- **Stockage** : Côté client, le token est stocké dans le `localStorage` et injecté automatiquement dans l'en-tête `Authorization: Bearer <token>` de toutes les requêtes API via le `JwtInterceptor` d'Angular.
- **Validation** : Le `JwtAuthenticationFilter` du backend intercepte chaque requête, valide la signature et extrait les informations de l'utilisateur pour alimenter le contexte de sécurité de Spring Security.

### Gestion fine des Accès
- **Fichiers protégés** : Un utilisateur authentifié possède un accès exclusif à son historique de partages (`/api/files/history`) et peut supprimer ses propres fichiers (`DELETE /api/files/{uuid}`).
- **Protection par mot de passe** : Tout fichier peut être partagé avec une clé de mot de passe optionnelle. Le mot de passe n'est jamais stocké en clair : il est haché à l'aide de **BCrypt** avant insertion en base de données. Lors du téléchargement, le client doit fournir le mot de passe qui est validé via `BCrypt.checkpw`.

---

## 2. Sécurisation des Dépôts de Fichiers

Le téléversement de fichiers représente le risque de sécurité le plus élevé. Les contre-mesures suivantes ont été implémentées **côté backend** (et non plus uniquement côté frontend) :

### Isolation Physique des Fichiers
- Les fichiers ne sont **jamais** stockés dans le répertoire public du serveur web (ce qui permettrait leur exécution directe en cas de scripts malveillants).
- Ils sont enregistrés dans un répertoire isolé `/app/uploads` (mappé sur un volume Docker persistant et non accessible depuis le web).
- Les fichiers physiques sont renommés sur le disque en utilisant des **UUID v4** générés de manière cryptographique. Le nom d'origine et le type MIME sont stockés de manière sécurisée en base de données et ne sont restitués qu'au moment du téléchargement légitime.
- **Défense contre le path traversal** : `FileStorageService.loadFileAsResource` et `deletePhysicalFile` vérifient systématiquement que le chemin résolu reste sous le répertoire de stockage (`filePath.startsWith(fileStorageLocation)`), empêchant l'accès à des fichiers hors zone (ex: `/etc/passwd`).

### Validation et Restrictions Strictes (Backend + Frontend)

La validation est désormais appliquée **à la fois côté frontend (UX) et côté backend (sécurité)**. La validation backend est implémentée dans `FileValidationService` et appelée systématiquement par `FileStorageService.storeFile` **avant** toute écriture sur disque.

#### Trois piliers défensifs

1. **Taille maximale** : Limitée à **1 Go** par fichier (configurée via `spring.servlet.multipart.max-file-size`). Un fichier dépassant cette limite déclenche une `MaxUploadSizeExceededException` interceptée par `GlobalExceptionHandler` qui renvoie un `413 Payload Too Large`.

2. **Liste blanche d'extensions** : Toute extension absente de la liste blanche (`FileValidationService.ALLOWED_EXTENSIONS`) est rejetée avec un `400 Bad Request`. Cette approche par liste blanche bloque par construction :
   - Les exécutables Windows : `.exe`, `.bat`, `.cmd`, `.msi`, `.ps1`, `.vbs`, `.scr`, `.com`
   - Les scripts shell : `.sh`, `.bash`
   - Les archives Java exécutables : `.jar`, `.war`
   - Tout format non explicitement autorisé (`.dll`, `.app`, etc.)

3. **Détection du type MIME réel par Apache Tika** :
   - L'en-tête `Content-Type` fourni par le client n'est **plus utilisé** (il est falsifiable : un attaquant peut envoyer un `.exe` avec `Content-Type: image/png`).
   - À la place, **Apache Tika** analyse le contenu binaire réel du fichier pour détecter son type MIME (`FileValidationService.validateAndDetectMimeType`).
   - Le type détecté est ensuite comparé à l'extension déclarée (`isMimeConsistentWithExtension`) : un `.exe` renommé en `.png` sera détecté comme `application/x-msdownload` par Tika et rejeté avec un `400 Bad Request` (message "Incohérence détectée").
   - Le type MIME détecté par Tika est celui persisté en base (`FileMetadata.fileType`), et non plus le `Content-Type` client.

### Validation côté Frontend (UX)
- Le composant `UploadComponent` rejette localement les extensions `.exe`, `.bat`, `.sh`, `.cmd` avant l'envoi, avec un message clair à l'utilisateur. Cette validation UX ne remplace pas la validation backend (un attaquant peut contourner le frontend), mais améliore l'expérience utilisateur légitime.

---

## 3. Protection contre les Vulnérabilités Majeures (OWASP)

### Injection SQL
- Tous les accès à la base de données PostgreSQL sont orchestrés par **Spring Data JPA** (Hibernate).
- Hibernate utilise systématiquement des requêtes préparées (`PreparedStatement`), garantissant que les paramètres de requêtes ne peuvent pas modifier la structure de la commande SQL.

### Cross-Origin Resource Sharing (CORS)
- Le partage de ressources d'origine croisée est strictement encadré dans `SecurityConfiguration.corsConfigurationSource`.
- **Origines autorisées** : seules les origines listées dans la propriété `cors.allowed-origins` (de `application.properties`) sont acceptées. Par défaut : `http://localhost:80`, `http://localhost:4200`, `http://localhost`.
- En production, on positionne la variable d'environnement `CORS_ALLOWED_ORIGINS=https://app.datashare.example` pour restreindre aux origines du frontend déployé.
- **Correction** : auparavant la configuration utilisait `allowedOriginPatterns("*")` avec `allowCredentials(true)`, ce qui ouvrait l'API à toutes les origines tout en autorisant les cookies — combinaison explicitement déconseillée par l'OWASP. Ce comportement est corrigé : `setAllowedOrigins(origins)` avec une liste stricte.

### Fuite d'Informations dans les Réponses d'Erreur
- `GlobalExceptionHandler` ne renvoie **jamais** le message brut d'une exception générique (`Exception.getMessage()`) au client, car celui-ci peut contenir des informations sensibles (chemins internes, versions de bibliothèques, structure de la base de données).
- Seules les exceptions métier `AppException` (dont le message est contrôlé par le code applicatif) sont renvoyées telles quelles.
- Les exceptions génériques sont journalisées côté serveur (`System.err.println`) et remplacées par un message générique : *"Une erreur inattendue s'est produite. Veuillez réessayer ultérieurement."*

### Protection contre les Dépôts Sans Fin (DoS)
- Chaque fichier dispose d'une date d'expiration fixée obligatoirement entre **1 et 7 jours** après sa mise en ligne.
- Un démon d'arrière-plan (cron task programmée quotidiennement à minuit) supprime définitivement tous les fichiers physiques et leurs métadonnées associées une fois arrivés à expiration, libérant ainsi l'espace disque du serveur de manière automatisée.

---

## 4. Spécification OpenAPI

Une spécification OpenAPI 3.0 complète est disponible à l'URL `/openapi.yaml` (servie depuis `src/main/resources/static/openapi.yaml`). Elle documente l'ensemble des endpoints REST, les schémas de requêtes/réponses, les codes d'erreur attendus, et les exigences d'authentification.

---

## 5. Sauvegarde de la Base de Données

Un script `backup-db.sh` est fourni à la racine du dépôt pour sauvegarder la base PostgreSQL vers un fichier horodaté (voir `MAINTENANCE.md` pour le mode d'emploi).

---

## 6. Récapitulatif des Corrections Apportées (vs évaluation initiale)

| Domaine | Avant | Après |
|---|---|---|
| Validation fichiers backend | Absente (uniquement frontend) | `FileValidationService` avec liste blanche + Tika |
| Type MIME | `file.getContentType()` (client, falsifiable) | Détection Tika par contenu binaire |
| CORS | `allowedOriginPatterns("*")` + credentials | Liste stricte d'origines configurables |
| Exception handler | Renvoyait `ex.getMessage()` brut | Message générique pour exceptions non contrôlées |
| Path traversal | Non vérifié dans `loadFileAsResource` | `filePath.startsWith(fileStorageLocation)` |
| Code de réponse upload | `200 OK` | `201 Created` (cohérent avec la création de ressource) |
| OpenAPI | Absent | `openapi.yaml` statique servie sur `/openapi.yaml` |
| backup-db.sh | Absent du dépôt | Présent à la racine |

---

## 7. Confidentialité et Protection des Données (RGPD)

L'application intègre une politique stricte de traitement des données personnelles conformément aux exigences du RGPD :
- **Consentement explicite** : Une case à cocher obligatoire est requise lors de l'inscription.
- **Transparence** : Une page dédiée à la Politique de Confidentialité (`/privacy`) est accessible depuis le frontend.
- **Minimisation** : Seules les données strictement nécessaires (email, nom) sont collectées et conservées.
- **Droit à l'oubli** : Les fichiers téléversés expirent automatiquement et sont détruits de manière irréversible. Les mots de passe (comptes et fichiers) sont systématiquement hachés et jamais stockés en clair.
