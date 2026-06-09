# DataShare — Projet 3 : Pilotez le développement d'une solution informatique

Bienvenue sur le projet **DataShare** !

L'objectif de ce projet est de concevoir et développer de bout en bout une solution informatique sécurisée de partage de fichiers inspirée de WeTransfer, en respectant les principes d'une architecture moderne, d'une couverture de tests rigoureuse, et d'un déploiement conteneurisé.

---

## 🎯 Spécifications Fonctionnelles

1. **Partage de fichiers** :
   - Dépôt de fichiers de manière anonyme ou connectée.
   - Durée de vie configurable pour chaque dépôt (entre **1 et 7 jours**).
   - Protection optionnelle du téléchargement par un **mot de passe**.
2. **Espace Utilisateur** :
   - Inscription et connexion sécurisée.
   - Tableau de bord listant l'historique des partages actifs de l'utilisateur.
   - Possibilité de copier le lien de partage ou de supprimer manuellement un partage.
3. **Sécurité et Validations** :
   - Limite de taille fixée à **1 Go** par téléversement.
   - **Interdiction stricte des fichiers exécutables** (ex: `.exe`, `.bat`, `.sh`, `.cmd`) pour prévenir la propagation de malwares.
   - Masquage des chemins physiques et renommage des fichiers par des UUID v4 aléatoires sur le serveur.
4. **Maintenance automatique** :
   - Purge automatique quotidienne (tâche planifiée Cron) supprimant les fichiers physiques et leurs métadonnées à expiration.

---

## 🛠️ Stack Technique Recommandée

- **Backend** : Spring Boot 4.x / Spring Security 7.x (Java 21)
- **Frontend** : Angular 22.x (Node 22.x, Standalone components, Signals)
- **Base de Données** : PostgreSQL 16
- **Conteneurisation** : Docker / Docker Compose

---

## 🚀 Étapes de Développement attendues

1. **Base de Données** : Modéliser le schéma SQL (User, FileMetadata, Tag) et configurer l'instance PostgreSQL.
2. **Backend API** : Développer les API REST de dépôt, téléchargement, historique et gestion des comptes.
3. **Sécurisation** : Configurer la chaîne de sécurité stateless (JWT) et le hachage des mots de passe (BCrypt).
4. **Frontend UI** : Concevoir une interface utilisateur responsive en Glassmorphism (Purple/Indigo Dark Mode) pour le dépôt, le téléchargement et le dashboard.
5. **Dockerisation** : Écrire les Dockerfiles de build multi-stage et le compose.yaml pour orchestrer les services.
6. **Tests et Qualité** : Écrire les tests unitaires et d'intégration couvrant 100% des cas d'utilisation critiques.
7. **Documentation** : Rédiger la documentation technique de maintenance, performance, sécurité et test.

---

*Bon développement !*
