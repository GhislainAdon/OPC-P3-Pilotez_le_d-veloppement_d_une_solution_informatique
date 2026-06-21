# Plan de Suivi de Qualité — Performance

DataShare traite des volumes de données potentiellement importants (limite de 1 Go par dépôt). L'application doit maintenir une excellente réactivité, minimiser la consommation de mémoire RAM côté serveur, et optimiser le temps de chargement côté client.

---

## ⚡ 1. Optimisations Backend & Gestion de la Mémoire

### Streaming de Fichiers (Zéro Fuite Mémoire)
- **Problème** : Charger un fichier volumineux (ex: 500 Mo) entièrement en mémoire RAM sous forme de tableau d'octets (`byte[]`) saturerait immédiatement la machine virtuelle Java (JVM) en cas d'accès simultanés.
- **Solution** :
  - **À l'import** : Spring Boot utilise `MultipartFile` qui stocke temporairement les paquets sur le disque si la taille dépasse 4 Ko.
  - **À l'export (téléchargement)** : Le `FileController` renvoie une ressource de type `StreamingResponseBody` ou `InputStreamResource`. Le fichier est lu par blocs (chunks) directement depuis le disque et écrit à la volée dans le flux de sortie HTTP, réduisant la consommation de RAM serveur à quelques kilo-octets par téléchargement actif.

### Indexation de la Base de Données
- Pour garantir des requêtes ultra-rapides (< 10ms) sur les métadonnées, des index PostgreSQL ont été positionnés sur les colonnes clés :
  - `uuid` (colonne de recherche unique pour le téléchargement public).
  - `user_id` (clé étrangère de liaison pour charger l'historique de l'utilisateur connecté).
  - `is_expired` (pour optimiser le parcours de la tâche cron quotidienne de nettoyage).

---

## 🎨 2. Optimisations Frontend (Angular 22)

### Lazy Loading des Routes
- Pour accélérer le chargement initial de la page d'accueil, l'application Angular utilise le chargement paresseux (lazy loading) pour toutes ses routes secondaires (`/login`, `/register`, `/dashboard`, `/download/:uuid`).
- Les bundles JavaScript de ces composants ne sont téléchargés par le navigateur que lorsque l'utilisateur navigue vers les pages correspondantes.

### Angular Signals
- L'utilisation des **Signals** d'Angular 22 (`currentUser`, `uploadState`, `progressPercent`) évite les cycles de détection de changements trop lourds (Zone.js). Seuls les éléments DOM liés au signal modifié sont mis à jour, garantissant une UI fluide à 60 FPS lors de l'affichage de la progression de l'upload.

---

## 🧪 3. Plan d'Audit de Performance (Charge & Scalabilité)

Pour valider la tenue à la charge de la solution en production, nous préconisons la mise en place de tests de charge avec **k6**.

### Exemple de script d'audit k6 (`performance-test.js`)
```javascript
import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Montée en charge à 20 utilisateurs
    { duration: '1m', target: 20 },  // Palier à 20 utilisateurs
    { duration: '30s', target: 0 },  // Descente
  ],
};

export default function () {
  // Simulation de la récupération des détails d'un fichier public
  const res = http.get('http://localhost:8080/api/files/download/mock-uuid/details');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'transaction time < 200ms': (r) => r.timings.duration < 200,
  });
  sleep(1);
}
```
Commandes recommandées pour auditer :
```bash
k6 run tests/load/load-test.js
```

### Résultats d'exécution

Les résultats d'une exécution de test de charge (20 VUs, 30s) démontrent la tenue de la charge. Le rapport complet est disponible dans `tests/load/k6-results.txt`.

**Synthèse des performances :**
- **1945 requêtes exécutées** avec un taux de réussite de 100%.
- Le **p(95) global est de 29.1 ms** (largement en deçà du seuil fixé à 500 ms).
- Les scénarios lourds (`upload_duration`) affichent des performances optimales sans dégradation.
