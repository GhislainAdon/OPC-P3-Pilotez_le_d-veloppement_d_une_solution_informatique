import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page-layout animate-fade-in">
      <header class="top-app-bar" role="banner">
        <div class="logo-wrapper" routerLink="/" role="link" aria-label="Retour à l'accueil">
          <span class="logo">DataShare</span>
        </div>
      </header>

      <main class="main-content" role="main">
        <div class="glass-panel text-content-card">
          <h1 class="page-title">Politique de Confidentialité</h1>
          
          <section class="policy-section">
            <h2>1. Collecte et traitement des données</h2>
            <p>Dans le cadre de l'utilisation de DataShare, nous collectons les données strictement nécessaires au fonctionnement du service :</p>
            <ul>
              <li><strong>Données d'identification :</strong> Email, Prénom, Nom (lors de la création d'un compte).</li>
              <li><strong>Données de fichiers :</strong> Métadonnées techniques (taille, type MIME, date d'expiration) et le fichier binaire lui-même (conservé de manière isolée).</li>
            </ul>
          </section>

          <section class="policy-section">
            <h2>2. Finalité et durée de conservation</h2>
            <p>Les fichiers téléversés sont conservés pour une durée déterminée par l'utilisateur (entre 1 et 7 jours). À l'expiration de ce délai, une tâche automatisée (cron) procède à la suppression irréversible du fichier physique et de ses métadonnées.</p>
            <p>Les mots de passe des fichiers et des comptes sont hachés cryptographiquement (BCrypt) et ne sont jamais stockés en clair.</p>
          </section>

          <section class="policy-section">
            <h2>3. Sécurité de vos données</h2>
            <p>Nous appliquons de strictes mesures de sécurité (isolation des fichiers, vérification du type de contenu par liste blanche et analyse binaire, protection contre les injections, etc.) pour protéger vos informations contre toute altération ou accès non autorisé.</p>
          </section>

          <section class="policy-section">
            <h2>4. Vos droits (RGPD)</h2>
            <p>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement ("droit à l'oubli") et de portabilité de vos données. Pour exercer vos droits, vous pouvez utiliser les fonctionnalités de suppression intégrées à votre Espace Personnel, ou nous contacter directement.</p>
          </section>
          
          <div class="action-footer">
            <button routerLink="/" class="btn-primary">Retour à l'accueil</button>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .text-content-card {
      max-width: 800px;
      margin: 40px auto;
      padding: 40px;
    }
    .page-title {
      font-family: var(--font-title);
      font-weight: 800;
      font-size: 2.2rem;
      margin-bottom: 32px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .policy-section {
      margin-bottom: 32px;
    }
    .policy-section h2 {
      font-family: var(--font-title);
      font-size: 1.4rem;
      color: var(--text-main);
      margin-bottom: 12px;
    }
    .policy-section p, .policy-section li {
      color: var(--text-muted);
      line-height: 1.6;
      font-size: 1rem;
      margin-bottom: 8px;
    }
    .policy-section ul {
      padding-left: 20px;
      margin-bottom: 16px;
    }
    .logo-wrapper { cursor: pointer; }
    .logo {
      font-family: var(--font-title);
      font-weight: 800;
      font-size: 1.8rem;
      background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-decoration: none;
    }
    .action-footer {
      margin-top: 40px;
      text-align: center;
    }
  `]
})
export class PrivacyComponent {
}
