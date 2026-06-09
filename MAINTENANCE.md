# Plan de Suivi de Qualité — Maintenance & Exploitation

Le maintien en conditions opérationnelles (MCO) de DataShare nécessite des mécanismes de surveillance de l'infrastructure (notamment de l'espace disque en raison de la limite d'upload de 1 Go), une gestion rigoureuse des logs, et une stratégie claire de sauvegarde et de mise à jour.

---

## 📊 1. Surveillance de l'Espace Disque & Alertes

Le stockage physique des fichiers s'effectue dans `/app/uploads`. Afin d'éviter un blocage du serveur par saturation du disque :
- **Seuil d'alerte** : Une alerte critique doit se déclencher si l'espace disque disponible sur le volume de stockage passe sous la barre des **20%**.
- **Nettoyage automatique** : La tâche cron quotidienne s'exécute chaque nuit à minuit (`@Scheduled(cron = "0 0 0 * * ?")`). Elle purge physiquement le dossier `/app/uploads` et supprime les lignes correspondantes en base de données pour tous les partages ayant dépassé leur durée de vie (1 à 7 jours).

---

## 📝 2. Gestion des Logs & Niveaux de Gravité

Les logs de l'application sont formatés pour être facilement indexables par des solutions centralisées (ex: pile ELK ou Loki).

### Niveaux de Logs configurés
- **`INFO`** : Traces des actions courantes (démarrage, arrêt, téléversement de fichier avec taille et type, déconnexion).
- **`WARN`** : Événements inhabituels sans impact critique (tentatives de connexion infructueuses, mot de passe incorrect lors du téléchargement d'un fichier).
- **`ERROR`** : Problèmes bloquants nécessitant une intervention (connexion DB perdue, erreur d'écriture disque, échec de purge automatique des fichiers expirés).

---

## 💾 3. Stratégie de Sauvegarde (Backup)

### Base de Données PostgreSQL
Une tâche计划 de sauvegarde journalière doit être planifiée sur l'hôte docker.
Exemple de script de sauvegarde (`backup-db.sh`) :
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/datashare"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
docker exec -t datashare-db pg_dump -U postgres datashare > $BACKUP_DIR/datashare_$DATE.sql
# Conserver uniquement les 7 dernières sauvegardes
find $BACKUP_DIR -type f -mtime +7 -name "*.sql" -delete
```

### Stockage des Fichiers Physiques
Les fichiers partagés étant temporaires (durée de vie maximale de 7 jours), ils ne requièrent pas de sauvegarde à long terme. Cependant, les métadonnées de la base de données doivent être répliquées régulièrement pour restaurer l'état des partages actifs en cas d'incident.

---

## 🔧 4. Maintenance Évolutive & Dépendances

### Gestion des Versions
- **Backend (Spring Boot 4 / Java 21)** : Les dépendances critiques sont centralisées dans le fichier `pom.xml`. Les mises à jour de sécurité de la JVM et de Spring Framework doivent être appliquées semestriellement.
- **Frontend (Angular 22 / Node 22)** : Audit quotidien des dépendances vulnérables via la commande :
  ```bash
  cd frontend
  npm audit
  ```
- **Renouvellement des clés JWT** : La clé de signature JWT configurée dans les variables d'environnement (`application.properties` ou compose) doit être renouvelée tous les 12 mois.
