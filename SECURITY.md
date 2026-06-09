# Plan de Suivi de Qualité — Sécurité

La sécurité est un pilier fondamental de DataShare. En tant qu'application de partage de fichiers, elle s'expose à de multiples vecteurs d'attaque (dépôt de fichiers malveillants, vols de session, fuites de données privées, dénis de service). Ce document formalise les mesures et la politique de sécurité mises en place.

---

## 🔒 1. Authentification & Autorisation

### Stateless JWT (JSON Web Tokens)
- **Principe** : L'authentification est entièrement sans état (stateless). Aucun identifiant de session n'est stocké côté serveur.
- **Cycle de vie** : Lors d'une connexion réussie (`POST /api/auth/login`), le serveur génère un token JWT signé avec un algorithme HMAC-SHA256 à l'aide d'une clé secrète forte (minimum 256 bits).
- **Stockage** : Côté client, le token est stocké dans le `localStorage` et injecté automatiquement dans l'en-tête `Authorization: Bearer <token>` de toutes les requêtes API via le `JwtInterceptor` d'Angular.
- **Validation** : Le `JwtAuthenticationFilter` du backend intercepte chaque requête, valide la signature et extrait les informations de l'utilisateur pour alimenter le contexte de sécurité de Spring Security.

### Gestion fine des Accès
- **Fichiers protégés** : Un utilisateur authentifié possède un accès exclusif à son historique de partages (`/api/files/history`) et peut supprimer ses propres fichiers (`DELETE /api/files/{uuid}`).
- **Protection par mot de passe** : Tout fichier peut être partagé avec une clé de mot de passe optionnelle. Le mot de passe n'est jamais stocké en clair : il est haché à l'aide de **BCrypt** avant insertion en base de données. Lors du téléchargement, le client doit fournir le mot de passe qui est validé via `BCrypt.checkpw`.

---

## 📁 2. Sécurisation des Dépôts de Fichiers

Le téléversement de fichiers représente le risque de sécurité le plus élevé. Les contre-mesures suivantes ont été implémentées :

### Isolation Physique des Fichiers
- Les fichiers ne sont **jamais** stockés dans le répertoire public du serveur web (ce qui permettrait leur exécution directe en cas de scripts malveillants).
- Ils sont enregistrés dans un répertoire isolé `/app/uploads` (mappé sur un volume Docker persistant et non accessible depuis le web).
- Les fichiers physiques sont renommés sur le disque en utilisant des **UUID v4** générés de manière cryptographique. Le nom d'origine et le type MIME sont stockés de manière sécurisée en base de données et ne sont restitués qu'au moment du téléchargement légitime.

### Validation et Restrictions Strictes
- **Taille Maximale** : Limitée de manière stricte à **1 Go** par fichier (configurée via `spring.servlet.multipart.max-file-size` et validée côté client avant envoi).
- **Rejet des Fichiers Exécutables** : Les extensions exécutables comme `.exe`, `.bat`, `.cmd`, `.sh`, `.msi` sont rejetées par le backend (dans `FileStorageService`) et par le frontend (dans `UploadComponent`), afin d'éviter le stockage et le partage de virus ou malwares.

---

## 🛡️ 3. Protection contre les Vulnérabilités Majeures (OWASP)

### Injection SQL
- Tous les accès à la base de données PostgreSQL sont orchestrés par **Spring Data JPA** (Hibernate).
- Hibernate utilise systématiquement des requêtes préparées (`PreparedStatement`), garantissant que les paramètres de requêtes ne peuvent pas modifier la structure de la commande SQL.

### Cross-Origin Resource Sharing (CORS)
- Le partage de ressources d'origine croisée est strictement encadré dans `ApplicationSecurityConfig`.
- Seules les requêtes provenant de l'hôte frontend légitime (par défaut `http://localhost`) sont autorisées à communiquer avec l'API, bloquant ainsi les requêtes malveillantes d'autres sites web.

### Protection contre les Dépôts Sans Fin (DoS)
- Chaque fichier dispose d'une date d'expiration fixée obligatoirement entre **1 et 7 jours** après sa mise en ligne.
- Un démon d'arrière-plan (cron task programmée quotidiennement) supprime définitivement tous les fichiers physiques et leurs métadonnées associées une fois arrivés à expiration, libérant ainsi l'espace disque du serveur de manière automatisée.
