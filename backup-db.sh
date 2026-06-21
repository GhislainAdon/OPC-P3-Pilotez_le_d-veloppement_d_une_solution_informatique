#!/usr/bin/env bash
#
# backup-db.sh — Sauvegarde de la base PostgreSQL DataShare
# =================================================================
#
# Génère un dump SQL horodaté de la base `datashare` et le compresse
# dans le répertoire ./backups/. Les sauvegardes de plus de 30 jours
# sont automatiquement purgées.
#
# Usage :
#   ./backup-db.sh                         # utilise les variables d'env par défaut
#   DB_HOST=db DB_USER=postgres DB_PASSWORD=secret ./backup-db.sh
#
# Variables d'environnement (avec valeurs par défaut) :
#   DB_HOST       (défaut: localhost)
#   DB_PORT       (défaut: 5432)
#   DB_NAME       (défaut: datashare)
#   DB_USER       (défaut: postgres)
#   DB_PASSWORD   (défaut: password)  — peut aussi être lue via ~/.pgpass
#   BACKUP_DIR    (défaut: ./backups)
#   RETENTION_DAYS (défaut: 30)
#
set -euo pipefail

# === Configuration ===
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-datashare}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-password}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# === Préparation ===
mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}-${TIMESTAMP}.sql.gz"

# Vérifier que pg_dump est installé
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERREUR : pg_dump n'est pas installé. Installez le paquet postgresql-client." >&2
  exit 1
fi

# === Sauvegarde ===
echo "[$(date -Iseconds)] Début de la sauvegarde de la base '$DB_NAME' sur $DB_HOST:$DB_PORT"

export PGPASSWORD="$DB_PASSWORD"
pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --format=custom \
  --no-owner \
  --no-privileges \
  | gzip -9 > "$BACKUP_FILE"
unset PGPASSWORD

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date -Iseconds)] Sauvegarde terminée : $BACKUP_FILE ($BACKUP_SIZE)"

# === Purge des sauvegardes anciennes ===
echo "[$(date -Iseconds)] Purge des sauvegardes de plus de $RETENTION_DAYS jours..."
find "$BACKUP_DIR" -name "${DB_NAME}-*.sql.gz" -type f -mtime "+$RETENTION_DAYS" -print -delete

echo "[$(date -Iseconds)] Opération de sauvegarde terminée avec succès."

# === Astuce : automatisation cron ===
# Pour exécuter cette sauvegarde tous les jours à 02h00, ajoutez dans crontab :
# 0 2 * * * /chemin/vers/backup-db.sh >> /var/log/datashare-backup.log 2>&1
