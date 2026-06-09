import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FileService, FileResponse } from '../file.service';

@Component({
  selector: 'app-download',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="download-wrapper animate-fade-in">
      <!-- Loading State -->
      <div *ngIf="state() === 'LOADING'" class="glass-panel loading-card">
        <div class="loader"></div>
        <p>Récupération des détails du fichier...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="state() === 'ERROR'" class="glass-panel status-card error-card">
        <div class="status-icon">⚠️</div>
        <h2>Lien de téléchargement invalide ou expiré</h2>
        <p class="status-desc">{{ errorMessage() }}</p>
        <button routerLink="/" class="btn-primary">Retour à l'accueil</button>
      </div>

      <!-- Password Prompt State -->
      <div *ngIf="state() === 'PASSWORD_PROMPT'" class="glass-panel download-card">
        <div class="file-icon-large">🔒</div>
        <h2 class="file-name">{{ fileDetails()?.originalName }}</h2>
        <p class="file-info-text">Ce fichier est protégé par un mot de passe.</p>

        <form [formGroup]="passwordForm" (ngSubmit)="onPasswordSubmit()" class="password-form">
          <div class="form-group">
            <input 
              type="password" 
              formControlName="password" 
              class="form-control" 
              placeholder="Entrez le mot de passe"
              [class.invalid]="passwordForm.invalid && passwordForm.touched"
            />
          </div>
          <div class="error-text" *ngIf="passwordError()">
            {{ passwordError() }}
          </div>
          <button type="submit" [disabled]="passwordForm.invalid || downloading()" class="btn-primary action-btn">
            <span *ngIf="!downloading()">Déverrouiller & Télécharger</span>
            <span *ngIf="downloading()" class="spinner"></span>
          </button>
        </form>
      </div>

      <!-- Ready to Download State -->
      <div *ngIf="state() === 'READY'" class="glass-panel download-card">
        <div class="file-icon-large">📄</div>
        <h2 class="file-name" [title]="fileDetails()?.originalName">{{ fileDetails()?.originalName }}</h2>
        
        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">Taille</span>
            <span class="meta-value">{{ formatBytes(fileDetails()?.fileSize || 0) }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Expire le</span>
            <span class="meta-value">{{ formatDate(fileDetails()?.expiryDate || '') }}</span>
          </div>
        </div>

        <div class="tag-container" *ngIf="fileDetails()?.tags && fileDetails()!.tags.length > 0">
          <span class="tag-badge" *ngFor="let tag of fileDetails()?.tags">#{{ tag }}</span>
        </div>

        <button (click)="triggerDownload()" [disabled]="downloading()" class="btn-primary action-btn download-btn">
          <span *ngIf="!downloading()">Télécharger le fichier</span>
          <span *ngIf="downloading()" class="spinner"></span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .download-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 120px);
      padding: 20px;
    }
    .loading-card, .status-card, .download-card {
      width: 100%;
      max-width: 480px;
      padding: 40px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .loader {
      border: 3px solid rgba(255, 255, 255, 0.1);
      border-top-color: var(--primary-hover);
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }
    .status-icon {
      font-size: 3rem;
      margin-bottom: 16px;
    }
    .status-desc {
      color: var(--text-muted);
      margin: 12px 0 32px;
      font-size: 0.95rem;
    }
    .file-icon-large {
      font-size: 4rem;
      margin-bottom: 20px;
    }
    .file-name {
      font-family: var(--font-title);
      font-weight: 700;
      font-size: 1.6rem;
      margin-bottom: 8px;
      word-break: break-all;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .file-info-text {
      color: var(--text-muted);
      margin-bottom: 24px;
      font-size: 0.95rem;
    }
    .password-form {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .error-text {
      color: var(--accent);
      font-size: 0.85rem;
    }
    .action-btn {
      width: 100%;
      height: 48px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      width: 100%;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--glass-border);
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .meta-label {
      font-size: 0.8rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta-value {
      font-weight: 600;
      font-size: 0.95rem;
    }
    .tag-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
      margin-bottom: 32px;
    }
    .tag-badge {
      background: rgba(138, 43, 226, 0.15);
      border: 1px solid rgba(138, 43, 226, 0.3);
      color: var(--text-main);
      padding: 4px 12px;
      border-radius: 100px;
      font-size: 0.8rem;
      font-weight: 500;
    }
    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: #fff;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class DownloadComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly fileService = inject(FileService);
  private readonly fb = inject(FormBuilder);

  readonly state = signal<'LOADING' | 'READY' | 'PASSWORD_PROMPT' | 'ERROR'>('LOADING');
  readonly fileDetails = signal<FileResponse | null>(null);
  readonly errorMessage = signal<string>('');
  readonly downloading = signal<boolean>(false);
  readonly passwordError = signal<string>('');

  uuid = '';
  passwordForm!: FormGroup;

  ngOnInit(): void {
    this.uuid = this.route.snapshot.paramMap.get('uuid') || '';
    this.passwordForm = this.fb.group({
      password: ['', [Validators.required]]
    });
    this.fetchDetails();
  }

  fetchDetails(): void {
    this.fileService.getFileDetails(this.uuid).subscribe({
      next: (details) => {
        this.fileDetails.set(details);
        if (details.isPasswordProtected) {
          this.state.set('PASSWORD_PROMPT');
        } else {
          this.state.set('READY');
        }
      },
      error: (err) => {
        this.state.set('ERROR');
        this.errorMessage.set(err.error?.message || "Impossible de récupérer les détails du fichier. Le lien est peut-être expiré.");
      }
    });
  }

  onPasswordSubmit(): void {
    if (this.passwordForm.invalid) return;
    this.triggerDownload(this.passwordForm.value.password);
  }

  triggerDownload(password?: string): void {
    this.downloading.set(true);
    this.passwordError.set('');

    this.fileService.downloadFileBlob(this.uuid, password).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.fileDetails()?.originalName || 'download';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        this.downloading.set(false);
        this.state.set('READY'); // Reset view state if previously in password prompt
      },
      error: (err) => {
        this.downloading.set(false);
        if (this.state() === 'PASSWORD_PROMPT') {
          this.passwordError.set('Mot de passe incorrect. Veuillez réessayer.');
        } else {
          this.state.set('ERROR');
          this.errorMessage.set("Une erreur est survenue lors du téléchargement.");
        }
      }
    });
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
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
