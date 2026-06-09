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
    <div class="dashboard-container animate-fade-in">
      <div class="glass-panel dashboard-card">
        
        <!-- Header -->
        <header class="header">
          <h1 class="logo" routerLink="/">DataShare</h1>
          <nav class="nav">
            <button routerLink="/" class="btn-primary nav-btn">Partager un fichier</button>
            <button (click)="logout()" class="btn-secondary nav-btn text-danger">Déconnexion</button>
          </nav>
        </header>

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
    </div>
  `,
  styles: [`
    .dashboard-container {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: calc(100vh - 120px);
      padding: 24px;
    }
    .dashboard-card {
      width: 100%;
      max-width: 1100px;
      padding: 32px;
      display: flex;
      flex-direction: column;
      gap: 32px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--glass-border);
      padding-bottom: 20px;
    }
    .logo {
      font-family: var(--font-title);
      font-weight: 800;
      font-size: 1.8rem;
      background: linear-gradient(135deg, #fff 0%, var(--primary-hover) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      cursor: pointer;
      text-decoration: none;
    }
    .nav {
      display: flex;
      gap: 16px;
    }
    .nav-btn {
      padding: 8px 18px;
      font-size: 0.9rem;
      border-radius: 10px;
    }
    .text-danger {
      color: var(--accent) !important;
      border-color: rgba(255, 0, 127, 0.2) !important;
    }
    .text-danger:hover {
      background: rgba(255, 0, 127, 0.1) !important;
    }
    .profile-section {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .profile-section h2 {
      font-family: var(--font-title);
      font-size: 1.8rem;
      font-weight: 700;
    }
    .user-email {
      color: var(--text-muted);
      font-size: 0.95rem;
    }
    .files-section {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .section-title {
      font-family: var(--font-title);
      font-size: 1.15rem;
      font-weight: 600;
      color: var(--text-muted);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
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
      border-top-color: var(--primary-hover);
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
      font-weight: 600;
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
      padding: 20px 24px;
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
      font-weight: 600;
      word-break: break-all;
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .file-sub-details {
      display: flex;
      font-size: 0.8rem;
      color: var(--text-muted);
      gap: 8px;
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
      background: rgba(138, 43, 226, 0.1);
      border: 1px solid rgba(138, 43, 226, 0.2);
      color: var(--text-muted);
      padding: 2px 8px;
      border-radius: 100px;
      font-size: 0.75rem;
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
    }
    .expiry-value {
      font-weight: 600;
      font-size: 0.9rem;
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
      background: rgba(138, 43, 226, 0.15);
      border: 1px solid rgba(138, 43, 226, 0.3);
      color: var(--text-main);
    }
    .btn-copy:hover {
      background: var(--primary);
      box-shadow: 0 0 10px var(--primary-glow);
    }
    .copied {
      background: #00e676 !important;
      border-color: #00e676 !important;
      color: #0b0813 !important;
    }
    .btn-delete {
      background: rgba(255, 0, 127, 0.15);
      border: 1px solid rgba(255, 0, 127, 0.3);
      color: var(--accent);
    }
    .btn-delete:hover {
      background: var(--accent);
      color: #fff;
      box-shadow: 0 0 10px var(--accent-glow);
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
