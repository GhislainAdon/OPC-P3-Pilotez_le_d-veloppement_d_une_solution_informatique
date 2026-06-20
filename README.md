# DataShare — Plateforme Sécurisée de Partage de Fichiers

DataShare est une application web moderne de partage de fichiers inspirée de WeTransfer, conçue pour être sécurisée, robuste et performante. Ce projet s'inscrit dans le cadre du Projet 3 de la formation d'Expert DevOps.

L'application respecte une architecture découplée avec un backend développé en **Spring Boot 4.0.6 (Java 21)** et un frontend développé en **Angular 22.0.0 (Node 22.22.3)**, utilisant **PostgreSQL 16** pour la base de données et **Docker Compose** pour l'orchestration des conteneurs.

---

## 🚀 Fonctionnalités Clés

- **Partage Public et Privé** : Possibilité d'importer des fichiers de manière anonyme ou authentifiée.
- **Sécurité de Bout en Bout** :
  - Authentification des utilisateurs via **JSON Web Tokens (JWT)**.
  - Hachage des mots de passe avec **BCrypt**.
  - Option de chiffrement/protection des téléchargements par mot de passe.
- **Gestion des Fichiers & Métadonnées** :
  - Générateur d'UUID uniques et sécurisés pour masquer le nom physique et l'emplacement de stockage des fichiers.
  - Limite de téléversement fixée à **1 Go**.
  - Restrictions strictes sur les formats de fichiers : **exécutables interdits** (`.exe`, `.bat`, `.sh`, `.cmd`).
  - Durée de vie configurable (entre **1 et 7 jours**).
- **Tableau de Bord Utilisateur** : Historique des partages actifs, copie rapide du lien de téléchargement, suppression à la demande (physique et logique).
- **Tâche Planifiée (Cron)** : Script de nettoyage quotidien automatique pour supprimer physiquement et logiquement tous les fichiers expirés.
- **Expérience Utilisateur Premium** : Interface Vibrant Pulse avec des dégradés chaleureux (Orange vers Rose), typographie moderne Hanken Grotesk et adaptabilité mobile complète.

---

## 🛠️ Stack Technique

### Backend
- **Framework** : Spring Boot 4.0.6 (Java 21)
- **Sécurité** : Spring Security 7.0 (Stateless JWT, BCrypt)
- **Base de Données** : PostgreSQL 16
- **Persistance** : Spring Data JPA / Hibernate
- **Outils** : Maven, Jackson v3 (utilisant `tools.jackson.databind`), JUnit 5, Mockito

### Frontend
- **Framework** : Angular 22.0.0 (Node 22.22.3)
- **Gestion du State** : Angular Signals
- **Style** : CSS standard, Typographie Hanken Grotesk (Google Fonts)
- **Testing** : Vitest 4.0.8, Angular unit-test builder

### DevOps & Conteneurisation
- **Docker / Docker Compose** : Orchestration multi-conteneurs (`datashare-db`, `datashare-backend`, `datashare-frontend`)
- **Nginx** : Utilisé comme serveur de fichiers statiques pour l'application Angular dans le conteneur frontend.

---

## 📦 Architecture & Modèle de Données

### Diagramme d'Architecture
```text
+--------------------------------------------------------------------------+
| Client navigateur                                                        |
|                  Angular 22 SPA                                          |
|         (Nginx :80 - lazy-loaded routes, Signals)                        |
+--------------------------------------------------------------------------+
                   | REST API + JWT (Bearer Token)
                   | http://localhost:8080/api
                   V
+--------------------------------------------------------------------------+
|         Spring Boot 4.0.6 (Java 21) - :8080                              |
|                                                                          |
|     +--------------------------------------------------------------+     |
|     | JwtAuthenticationFilter  ->   REST Controllers               |     |
|     | AuthController / FileController                              |     |
|     +--------------------------------------------------------------+     |
|     | Services Métier                                              |     |
|     | AuthService | FileMetadataService | FileStorageService       |     |
|     +--------------------------------------------------------------+     |
|     | Tâche Cron   (purge quotidienne minuit)                      |     |
|     +--------------------------------------------------------------+     |
|             | Spring Data JPA/Hibernate      | java.nio FileSystem |     |
+-------------|--------------------------------|---------------------+-----+
              |                                |
              V                                V
+---------------------------+    +-----------------------------------------+
| PostgreSQL 16   :5432     |    | Volume Docker /app/uploads              |
| tables: users,            |    | Fichiers renommés UUID v4               |
| file_metadata, tags       |    | (isolés du serveur web)                 |
+---------------------------+    +-----------------------------------------+
```

### Modèle de Données (MCD)
- **User** : Enregistre les comptes utilisateurs (email, mot de passe haché, nom, prénom).
- **FileMetadata** : Répertorie les fichiers téléversés, leur UUID unique, leur taille, type MIME, mot de passe de protection optionnel, date de dépôt et date d'expiration.
- **Tag** : Gère les étiquettes personnalisées associées aux fichiers partagés.

---

## ⚙️ Installation et Exécution locale

### Prérequis
- Docker Desktop et Docker Compose installés et actifs.
- Ports `80`, `8080` et `5432` disponibles sur l'hôte.

### Lancement avec Docker Compose
1. Clonez le dépôt et rendez-vous à la racine :
   ```bash
   git clone https://github.com/GhislainAdon/OPC-P3-Pilotez_le_d-veloppement_d_une_solution_informatique.git
   cd OPC-P3-Pilotez_le_d-veloppement_d_une_solution_informatique
   ```
2. Lancez les services en arrière-plan :
   ```bash
   docker compose up -d --build
   ```
3. Accédez à l'application :
   - Frontend : `http://localhost` (Port 80)
   - Backend API : `http://localhost:8080/api`
   - Base de données PostgreSQL : `localhost:5432`

### 🎮 Démo Interactive en Ligne (GitHub Codespaces)

Vous pouvez également lancer la démo de l'application en un clic dans votre navigateur via **GitHub Codespaces**. L'environnement de conteneurs (base de données, backend et frontend) sera entièrement configuré et démarré automatiquement :

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://github.com/codespaces/new?hide_repo_select=true&ref=solution&repo=GhislainAdon/OPC-P3-Pilotez_le_d-veloppement_d_une_solution_informatique)

---

## 🧪 Stratégie de Test & Qualité

### 1. Tests Unitaires & d'Intégration Backend
Pour exécuter les 32 tests unitaires et d'intégration Spring Boot en local :
```bash
cd backend
mvn test
```

### 2. Tests Unitaires Frontend
Pour exécuter les 34 tests unitaires Angular / Vitest en local :
```bash
cd frontend
npm install
npm test
```

### 3. Exécution des Tests via Docker (Environnement Isolé)
Pour lancer les suites de tests dans des conteneurs isolés (par exemple sur Git Bash sous Windows) sans dépendances locales :
- **Tests Backend (JUnit)** :
  ```bash
  MSYS_NO_PATHCONV=1 docker run --rm \
    --network=opc-p3-pilotez_le_d-veloppement_d_une_solution_informatique_default \
    -e SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/datashare \
    -v "$(pwd)/backend:/app" \
    -w /app \
    maven:3.9.8-eclipse-temurin-21 \
    mvn test
  ```
- **Tests Frontend (Vitest)** :
  ```bash
  MSYS_NO_PATHCONV=1 docker run --rm \
    -v "$(pwd)/frontend:/app" \
    -v /app/node_modules \
    -w /app \
    node:22.22.3-alpine \
    sh -c "npm install && npm run test -- --watch=false"
  ```

---

## 📄 Documentation Qualité & DevOps

Pour une description plus approfondie des protocoles de qualité, sécurité, performance et maintenance, veuillez consulter les plans de suivi dédiés :
- 📈 **[Plan de Test (TESTING.md)](file:///c:/Users/adon1/Documents/DEVOPS%202025/Formation/Openclassroom/Formation-Expert-Draft/projet3-12-05-au-01-06/OPC-P3-Pilotez_le_d-veloppement_d_une_solution_informatique/TESTING.md)** : Rapport de couverture de test et stratégies.
- 🔒 **[Plan de Sécurité (SECURITY.md)](file:///c:/Users/adon1/Documents/DEVOPS%202025/Formation/Openclassroom/Formation-Expert-Draft/projet3-12-05-au-01-06/OPC-P3-Pilotez_le_d-veloppement_d_une_solution_informatique/SECURITY.md)** : Gestion des accès, hachage, validation d'input et politique de sécurité.
- ⚡ **[Plan de Performance (PERF.md)](file:///c:/Users/adon1/Documents/DEVOPS%202025/Formation/Openclassroom/Formation-Expert-Draft/projet3-12-05-au-01-06/OPC-P3-Pilotez_le_d-veloppement_d_une_solution_informatique/PERF.md)** : Diagnostics de scalabilité, gestion de gros volumes de fichiers (limite 1 Go) et audits de performance.
- 🛠️ **[Plan de Maintenance (MAINTENANCE.md)](file:///c:/Users/adon1/Documents/DEVOPS%202025/Formation/Openclassroom/Formation-Expert-Draft/projet3-12-05-au-01-06/OPC-P3-Pilotez_le_d-veloppement_d_une_solution_informatique/MAINTENANCE.md)** : Gestion du cycle de vie opérationnel, logs, alertes et sauvegardes.
- 📓 **[Journal d'Utilisation de l'IA (Notion)](https://app.notion.com/p/37aee836963f81d1b2bed325c935df23?v=37aee836963f81099ad8000cb0c04500&source=copy_link)** : Journal de suivi de l'usage réfléchi et de l'analyse de l'IA tout au long du projet.
