import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileService, FileResponse } from '../file.service';
import { AuthService } from '../auth.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-layout animate-fade-in">
      <!-- Shared TopAppBar -->
      <header class="top-app-bar" data-purpose="header-navigation">
        <div class="logo-wrapper" routerLink="/">
          <span class="logo" id="brand-logo">DataShare</span>
        </div>
        <nav class="nav">
          <span *ngIf="authService.isLoggedIn()" class="user-greeting">
            Bonjour, <strong>{{ authService.currentUser()?.firstName || authService.currentUser()?.email }}</strong>
          </span>
          <button *ngIf="authService.isLoggedIn()" (click)="logout()" class="btn-secondary nav-btn text-danger">
            Déconnexion
          </button>
        </nav>
      </header>

      <!-- Main Content -->
      <main class="main-content">
        <div class="glass-panel dashboard-card">
          <!-- Profile Section -->
          <div class="profile-section">
            <h2>Mon Espace Personnel</h2>
            <p class="user-email">Session active : {{ authService.currentUser()?.email }}</p>
          </div>

          <!-- Files List -->
          <div class="files-section">
            <h3 class="section-title">Mes partages actifs ({{ files().length }})</h3>

            <!-- Loading -->
            <div *ngIf="loading()" class="loader-container">
              <div class="loader"></div>
              <p>Chargement de l'historique...</p>
            </div>

            <!-- Empty state -->
            <div *ngIf="!loading() && files().length === 0" class="empty-state">
              <div class="empty-icon">📁</div>
              <h4>Aucun fichier téléversé pour le moment</h4>
              <p>Commencez à partager des fichiers en toute sécurité dès aujourd'hui.</p>
              <button routerLink="/" class="btn-primary">Partager un fichier</button>
            </div>

            <!-- Grid/List of files -->
            <div *ngIf="!loading() && files().length > 0" class="files-list">
              <div *ngFor="let file of files()" class="file-item glass-panel">
                
                <div class="file-info-col">
                  <span class="file-icon">{{ file.isPasswordProtected ? '🔒' : '📄' }}</span>
                  <div class="file-details">
                    <h4 class="file-name" [title]="file.originalName">{{ file.originalName }}</h4>
                    <div class="file-sub-details">
                      <span>{{ formatBytes(file.fileSize) }}</span>
                      <span class="divider">•</span>
                      <span>Mis en ligne le {{ formatDate(file.uploadDate) }}</span>
                    </div>
                  </div>
                </div>

                <!-- Tags -->
                <div class="tags-col" *ngIf="file.tags && file.tags.length > 0">
                  <span class="tag-badge" *ngFor="let tag of file.tags">#{{ tag }}</span>
                </div>

                <!-- Expiry date badge -->
                <div class="expiry-col">
                  <span class="expiry-label">Expire le</span>
                  <span class="expiry-value">{{ formatDate(file.expiryDate) }}</span>
                </div>

                <!-- Actions -->
                <div class="actions-col">
                  <button (click)="copyLink(file.uuid)" class="btn-action btn-copy" [class.copied]="copiedUuid() === file.uuid">
                    {{ copiedUuid() === file.uuid ? 'Copié !' : 'Copier le lien' }}
                  </button>
                  <button (click)="deleteFile(file.uuid)" class="btn-action btn-delete">
                    Supprimer
                  </button>
                </div>

              </div>
            </div>

          </div>
        </div>
      </main>

    </div>

    <!-- Shared BottomNavBar -->
    <nav class="bottom-nav-bar" *ngIf="authService.isLoggedIn()">
      <a routerLink="/" class="nav-item">
        <span class="nav-item-icon">📤</span>
        <span>Transfert</span>
      </a>
      <a routerLink="/dashboard" class="nav-item active">
        <span class="nav-item-icon">📁</span>
        <span>Mon Espace</span>
      </a>
    </nav>
  `,
  styles: [`
    .dashboard-card {
      width: 100%;
      max-width: 1100px;
      padding: 32px;
      display: flex;
      flex-direction: column;
      gap: 32px;
    }
    .logo-wrapper {
      cursor: pointer;
    }
    .logo {
      font-family: var(--font-title);
      font-weight: 800;
      font-size: 1.8rem;
      background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-decoration: none;
    }
    .nav {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .nav-btn {
      padding: 8px 18px;
      font-size: 0.9rem;
      border-radius: 10px;
    }
    .text-danger {
      color: var(--primary) !important;
      border-color: rgba(232, 93, 104, 0.2) !important;
    }
    .text-danger:hover {
      background: rgba(232, 93, 104, 0.08) !important;
    }
    .profile-section {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .profile-section h2 {
      font-family: var(--font-title);
      font-size: 1.8rem;
      font-weight: 800;
      color: var(--text-main);
    }
    .user-email {
      color: var(--text-muted);
      font-size: 0.95rem;
      font-weight: 500;
    }
    .files-section {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .section-title {
      font-family: var(--font-title);
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-main);
      border-bottom: 1px solid var(--glass-border);
      padding-bottom: 8px;
    }
    .loader-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px;
    }
    .loader {
      border: 3px solid rgba(255, 255, 255, 0.1);
      border-top-color: var(--primary);
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 60px 20px;
      text-align: center;
    }
    .empty-icon {
      font-size: 3.5rem;
      margin-bottom: 16px;
    }
    .empty-state h4 {
      font-size: 1.2rem;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .empty-state p {
      color: var(--text-muted);
      font-size: 0.95rem;
      margin-bottom: 24px;
      max-width: 400px;
    }
    .files-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .file-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      border-radius: 16px;
      gap: 24px;
      flex-wrap: wrap;
    }
    .file-info-col {
      display: flex;
      align-items: center;
      gap: 16px;
      flex: 2;
      min-width: 250px;
    }
    .file-icon {
      font-size: 2.2rem;
    }
    .file-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .file-name {
      font-size: 1.05rem;
      font-weight: 700;
      word-break: break-all;
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
      color: var(--text-main);
    }
    .file-sub-details {
      display: flex;
      font-size: 0.8rem;
      color: var(--text-muted);
      gap: 8px;
      font-weight: 500;
    }
    .divider {
      color: var(--text-disabled);
    }
    .tags-col {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      flex: 1;
      min-width: 120px;
    }
    .tag-badge {
      background: rgba(232, 93, 104, 0.08);
      border: 1px solid rgba(232, 93, 104, 0.15);
      color: var(--primary);
      padding: 2px 8px;
      border-radius: 100px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .expiry-col {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 140px;
    }
    .expiry-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 600;
    }
    .expiry-value {
      font-weight: 700;
      font-size: 0.9rem;
      color: var(--text-main);
    }
    .actions-col {
      display: flex;
      gap: 12px;
      min-width: 230px;
    }
    .btn-action {
      flex: 1;
      padding: 10px 16px;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
      font-family: var(--font-title);
    }
    .btn-copy {
      background: rgba(249, 161, 117, 0.1);
      border: 1px solid rgba(249, 161, 117, 0.2);
      color: var(--text-main);
    }
    .btn-copy:hover {
      background: linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%);
      color: #fff;
      border-color: transparent;
      box-shadow: 0 4px 10px var(--primary-glow);
    }
    .copied {
      background: #e8f5e9 !important;
      border-color: #81c784 !important;
      color: #2e7d32 !important;
    }
    .btn-delete {
      background: rgba(232, 93, 104, 0.08);
      border: 1px solid rgba(232, 93, 104, 0.2);
      color: var(--primary);
    }
    .btn-delete:hover {
      background: var(--primary);
      color: #fff;
      box-shadow: 0 4px 10px var(--primary-glow);
    }
    @media (max-width: 900px) {
      .file-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
      }
      .actions-col {
        width: 100%;
      }
    }
  `]
})
export class HistoryComponent implements OnInit {
  private readonly fileService = inject(FileService);
  readonly authService = inject(AuthService);

  readonly files = signal<FileResponse[]>([]);
  readonly loading = signal<boolean>(true);
  readonly copiedUuid = signal<string>('');

  ngOnInit(): void {
    this.fetchHistory();
  }

  fetchHistory(): void {
    this.loading.set(true);
    this.fileService.getHistory().subscribe({
      next: (res) => {
        this.files.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  copyLink(uuid: string): void {
    const downloadUrl = `${window.location.origin}/download/${uuid}`;
    navigator.clipboard.writeText(downloadUrl).then(() => {
      this.copiedUuid.set(uuid);
      setTimeout(() => this.copiedUuid.set(''), 2000);
    });
  }

  deleteFile(uuid: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer définitivement ce partage ? Cette action est irréversible.')) {
      this.fileService.deleteFile(uuid).subscribe({
        next: () => {
          // Remove from local signal list
          this.files.set(this.files().filter(f => f.uuid !== uuid));
        },
        error: (err) => {
          alert(err.error?.message || 'La suppression a échoué.');
        }
      });
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Octets';
    const k = 1024;
    const sizes = ['Octets', 'Ko', 'Mo', 'Go'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  logout(): void {
    this.authService.logout();
  }
}
