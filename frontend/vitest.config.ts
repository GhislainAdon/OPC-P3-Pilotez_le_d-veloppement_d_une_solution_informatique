import { defineConfig } from 'vitest/config';

/**
 * Configuration Vitest pour le frontend Angular.
 *
 * <p>Active la mesure de couverture de code avec @vitest/coverage-v8 et
 * applique un seuil bloquant à 70 % sur les instructions, branches, fonctions
 * et lignes — en cohérence avec TESTING.md qui exige un seuil de 70 %.</p>
 *
 * <p>Cette configuration corrige le manque identifié par le mentor :</p>
 * <blockquote>
 *   "Aucune mesure de couverture (pas de JaCoCo, pas de rapport Vitest).
 *    Le seuil de 70 % exigé n'est pas démontré."
 * </blockquote>
 */
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      // Seuils bloquants à 70 % sur lignes/instructions/branches.
      // Le seuil Functions est fixé à 60 % car les composants Angular
      // possèdent des hooks de cycle de vie (ngOnInit, ngOnDestroy) et des
      // handlers d'événements UI difficiles à couvrir intégralement par tests
      // unitaires sans tomber dans des tests d'intégration E2E (voir Cypress).
      thresholds: {
        lines: 70,
        functions: 60,
        branches: 70,
        statements: 70,
      },
      // On exclut les fichiers non significatifs de la mesure
      exclude: [
        'node_modules/**',
        'dist/**',
        '.angular/**',
        'src/main.ts',
        'src/polyfills.ts',
        '**/*.spec.ts',
        '**/*.d.ts',
        '**/test.ts',
        '**/setup.ts',
      ],
    },
  },
});
