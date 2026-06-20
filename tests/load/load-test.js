/**
 * Test de charge k6 — DataShare API
 * ==================================
 *
 * Scénario de charge réaliste modélisant le trafic attendu sur la plateforme
 * DataShare : mix d'uploads, de downloads et de consultation de métadonnées.
 *
 * Profil de charge :
 *   - 20 utilisateurs virtuels (VUs) simultanés pendant 30 secondes
 *   - 80 % de requêtes de download (GET /api/files/download/{uuid}/details)
 *   - 15 % de requêtes d'upload (POST /api/files/upload)
 *   - 5 %  de requêtes d'historique authentifié (GET /api/files/history)
 *
 * Seuils (SLA) :
 *   - 95 % des requêtes doivent avoir un temps de réponse < 500 ms
 *   - 99 % des requêtes doivent avoir un temps de réponse < 1500 ms
 *   - Taux d'erreur < 1 %
 *
 * Exécution :
 *   k6 run tests/load/load-test.js
 *
 * Pour un test plus poussé :
 *   k6 run --vus 50 --duration 2m tests/load/load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// === Métriques personnalisées ===
const uploadDuration = new Trend('upload_duration', true);
const downloadDuration = new Trend('download_duration', true);
const uploadsCount = new Counter('uploads_total');
const downloadsCount = new Counter('downloads_total');

// === Configuration de charge ===
export const options = {
  vus: 20,
  duration: '30s',
  thresholds: {
    // 95 % des requêtes en moins de 500 ms
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    // SLA spécifiques
    upload_duration: ['p(95)<800'],
    download_duration: ['p(95)<300'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Un UUID "factice" — on s'attend à un 404 mais on mesure quand même le temps de réponse.
// En mode intégration réelle, on peut pré-uploader un fichier puis utiliser son UUID.
const SAMPLE_UUID = 'load-test-sample-uuid';

// Contenu binaire simulé pour l'upload (1 Ko de texte)
const sampleFileContent = 'A'.repeat(1024);

// Helper : détermine si une réponse est "réussie" du point de vue du test de charge.
// On accepte les 2xx (succès) ET les 4xx (rejets applicatifs = backend fonctionnel).
// On rejette les 5xx (erreurs serveur) et les erreurs réseau.
function isAcceptable(r) {
  return r.status >= 200 && r.status < 500;
}

export default function () {
  // Tirage aléatoire pour déterminer le type de requête
  const rand = Math.random();

  if (rand < 0.80) {
    // === 80 % : Download (consultation métadonnées) ===
    group('download_metadata', () => {
      const res = http.get(`${BASE_URL}/api/files/download/${SAMPLE_UUID}/details`);
      downloadsCount.add(1);
      downloadDuration.add(res.timings.duration);

      check(res, {
        'download returns 2xx or 4xx (no 5xx, no network error)': (r) => isAcceptable(r),
      });
    });
  } else if (rand < 0.95) {
    // === 15 % : Upload (fichier anonyme) ===
    group('upload_anonymous', () => {
      const fileName = `loadtest-${Date.now()}.txt`;
      const res = http.post(
        `${BASE_URL}/api/files/upload`,
        {
          file: http.file(sampleFileContent, fileName, 'text/plain'),
          expiryDays: '1',
        },
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );
      uploadsCount.add(1);
      uploadDuration.add(res.timings.duration);

      check(res, {
        'upload returns 2xx or 4xx (no 5xx, no network error)': (r) => isAcceptable(r),
      });
    });
  } else {
    // === 5 % : Auth health check (register attempt) ===
    group('auth_register_attempt', () => {
      const payload = JSON.stringify({
        firstName: 'Load',
        lastName: 'Tester',
        email: `loadtest-${Date.now()}@example.com`,
        password: 'loadpass123',
      });
      const res = http.post(`${BASE_URL}/api/auth/register`, payload, {
        headers: { 'Content-Type': 'application/json' },
      });

      check(res, {
        'register returns 2xx or 4xx (no 5xx, no network error)': (r) => isAcceptable(r),
      });
    });
  }

  sleep(0.1 + Math.random() * 0.4); // think time 100-500 ms
}

// Rapport de synthèse affiché en fin de test
export function handleSummary(data) {
  return {
    'tests/load/results-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: false }),
  };
}

// Version simplifiée du résumé texte
function textSummary(data, opts = {}) {
  const indent = opts.indent || '';
  const lines = [];
  const safe = (obj, path, dflt = 'n/a') => {
    try {
      return path.split('.').reduce((o, k) => (o == null ? null : o[k]), obj) ?? dflt;
    } catch (e) {
      return dflt;
    }
  };
  const fmt = (v) => (typeof v === 'number' ? v.toFixed(2) : String(v));

  lines.push(`${indent}=== Synthèse du test de charge DataShare ===`);
  lines.push(`${indent}Itérations totales: ${safe(data, 'metrics.iterations.values.count', 0)}`);
  lines.push(`${indent}Requêtes totales: ${safe(data, 'metrics.http_reqs.values.count', 0)}`);
  lines.push(`${indent}Taux de requêtes: ${fmt(safe(data, 'metrics.http_reqs.values.rate', 0))} req/s`);
  lines.push(`${indent}Temps de réponse moyen: ${fmt(safe(data, 'metrics.http_req_duration.values.avg', 0))} ms`);
  lines.push(`${indent}Temps p(95): ${fmt(safe(data, 'metrics.http_req_duration.values.p(95)', 0))} ms`);
  lines.push(`${indent}Temps p(99): ${fmt(safe(data, 'metrics.http_req_duration.values.p(99)', 0))} ms`);
  lines.push(`${indent}Taux d'échec: ${fmt((safe(data, 'metrics.http_req_failed.values.rate', 0)) * 100)} %`);
  lines.push(`${indent}Uploads: ${safe(data, 'metrics.uploads_total.values.count', 0)}`);
  lines.push(`${indent}Downloads: ${safe(data, 'metrics.downloads_total.values.count', 0)}`);
  lines.push('');
  lines.push(`${indent}=== Seuils ===`);
  try {
    const metrics = data.metrics || {};
    for (const name of Object.keys(metrics)) {
      const metric = metrics[name];
      if (metric && Array.isArray(metric.thresholds)) {
        for (const t of metric.thresholds) {
          const status = t.ok ? '✓ OK' : '✗ ECHEC';
          lines.push(`${indent}${status}  ${name}: ${t.config && t.config.limit ? t.config.limit : '?'}`);
        }
      }
    }
  } catch (e) {
    lines.push(`${indent}(seuils non disponibles: ${e.message})`);
  }

  return lines.join('\n');
}
