import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FileService, FileResponse } from '../file.service';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-download',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="page-layout animate-fade-in">
      <!-- Header -->
      <header class="header" data-purpose="header-navigation">
        <div class="logo-wrapper" routerLink="/">
          <span class="logo" id="brand-logo">DataShare</span>
        </div>
        <nav class="nav">
          <span *ngIf="authService.isLoggedIn()" class="user-greeting">
            Bonjour, <strong>{{ authService.currentUser()?.firstName || authService.currentUser()?.email }}</strong>
          </span>
          <button *ngIf="authService.isLoggedIn()" routerLink="/dashboard" class="btn-secondary nav-btn">
            Historique
          </button>
          <button *ngIf="authService.isLoggedIn()" (click)="logout()" class="btn-secondary nav-btn text-danger">
            Déconnexion
          </button>
          <button *ngIf="!authService.isLoggedIn()" routerLink="/login" class="btn-primary nav-btn" data-purpose="login-button">
            Se connecter
          </button>
        </nav>
      </header>

      <!-- Main Content Area -->
      <main class="main-content">
        <!-- Loading State -->
        <div *ngIf="state() === 'LOADING'" class="glass-panel loading-card" data-purpose="download-container">
          <div class="loader"></div>
          <p>Récupération des détails du fichier...</p>
        </div>

        <!-- Error State -->
        <div *ngIf="state() === 'ERROR'" class="glass-panel status-card error-card" data-purpose="download-container">
          <div class="status-icon">⚠️</div>
          <h2>Lien de téléchargement invalide ou expiré</h2>
          <p class="status-desc">{{ errorMessage() }}</p>
          <button routerLink="/" class="btn-primary">Retour à l'accueil</button>
        </div>

        <!-- Password Prompt State -->
        <div *ngIf="state() === 'PASSWORD_PROMPT'" class="glass-panel download-card" data-purpose="download-container">
          <h1 class="card-title" data-purpose="page-title">Télécharger un fichier</h1>
          
          <!-- File Details Info Box -->
          <div class="file-details-box" data-purpose="file-info">
            <div class="file-icon-wrapper">
              <svg class="file-svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
              </svg>
            </div>
            <div class="file-meta">
              <p class="file-name-title" [title]="fileDetails()?.originalName">{{ fileDetails()?.originalName }}</p>
              <p class="file-size-subtitle">{{ formatBytes(fileDetails()?.fileSize || 0) }}</p>
            </div>
          </div>

          <!-- Expiration Notice -->
          <div class="info-alert" data-purpose="status-alert">
            <svg class="info-svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
            </svg>
            <p class="info-text">Ce fichier expirera le {{ formatDate(fileDetails()?.expiryDate || '') }}</p>
          </div>

          <form [formGroup]="passwordForm" (ngSubmit)="onPasswordSubmit()" class="password-form" data-purpose="download-form">
            <div class="form-group">
              <label class="form-label" for="password">Mot de passe</label>
              <input 
                id="password"
                type="password" 
                formControlName="password" 
                class="form-control" 
                placeholder="Saisissez le mot de passe..."
                [class.invalid]="passwordForm.invalid && passwordForm.touched"
              />
            </div>
            <div class="error-text" *ngIf="passwordError()">
              {{ passwordError() }}
            </div>
            
            <button type="submit" [disabled]="passwordForm.invalid || downloading()" class="btn-primary action-btn" data-purpose="action-button">
              <svg *ngIf="!downloading()" class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
              </svg>
              <span *ngIf="!downloading()">Déverrouiller & Télécharger</span>
              <span *ngIf="downloading()" class="spinner"></span>
            </button>
          </form>
        </div>

        <!-- Ready to Download State -->
        <div *ngIf="state() === 'READY'" class="glass-panel download-card" data-purpose="download-container">
          <h1 class="card-title" data-purpose="page-title">Télécharger un fichier</h1>
          
          <!-- File Details Info Box -->
          <div class="file-details-box" data-purpose="file-info">
            <div class="file-icon-wrapper">
              <svg class="file-svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
              </svg>
            </div>
            <div class="file-meta">
              <p class="file-name-title" [title]="fileDetails()?.originalName">{{ fileDetails()?.originalName }}</p>
              <p class="file-size-subtitle">{{ formatBytes(fileDetails()?.fileSize || 0) }}</p>
            </div>
          </div>

          <!-- Expiration Notice -->
          <div class="info-alert" data-purpose="status-alert">
            <svg class="info-svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
            </svg>
            <p class="info-text">Ce fichier expirera le {{ formatDate(fileDetails()?.expiryDate || '') }}</p>
          </div>

          <!-- Tags if present -->
          <div class="tag-container" *ngIf="fileDetails()?.tags && fileDetails()!.tags.length > 0">
            <span class="tag-badge" *ngFor="let tag of fileDetails()?.tags">#{{ tag }}</span>
          </div>

          <button (click)="triggerDownload()" [disabled]="downloading()" class="btn-primary action-btn download-btn" data-purpose="action-button">
            <svg *ngIf="!downloading()" class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
            </svg>
            <span *ngIf="!downloading()">Télécharger</span>
            <span *ngIf="downloading()" class="spinner"></span>
          </button>
        </div>
      </main>

      <!-- Footer -->
      <footer class="footer" data-purpose="footer-info">
        <p class="footer-text">
          Copyright DataShare® 2025
        </p>
      </footer>
    </div>
  `,
  styles: [`
    .page-layout {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--glass-border);
      padding-bottom: 20px;
      width: 100%;
    }
    .logo-wrapper {
      cursor: pointer;
    }
    .logo {
      font-family: var(--font-title);
      font-weight: 800;
      font-size: 1.8rem;
      background: linear-gradient(135deg, #fff 0%, var(--primary-hover) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-decoration: none;
    }
    .nav {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .user-greeting {
      font-size: 0.9rem;
      color: var(--text-muted);
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
    .main-content {
      flex-grow: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 40px 0 80px;
    }
    .loading-card, .status-card, .download-card {
      width: 100%;
      max-width: 440px;
      padding: 32px;
      display: flex;
      flex-direction: column;
      align-items: center;
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
    .status-desc {
      color: var(--text-muted);
      margin: 12px 0 32px;
      font-size: 0.95rem;
      text-align: center;
    }
    .card-title {
      font-family: var(--font-title);
      font-size: 1.5rem;
      font-weight: 700;
      text-align: center;
      margin-bottom: 24px;
      color: var(--text-main);
    }
    .file-details-box {
      display: flex;
      align-items: center;
      gap: 16px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--glass-border);
      padding: 16px;
      border-radius: 16px;
      margin-bottom: 16px;
      width: 100%;
      text-align: left;
    }
    .file-icon-wrapper {
      background: rgba(138, 43, 226, 0.1);
      padding: 10px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .file-svg-icon {
      width: 24px;
      height: 24px;
      color: var(--primary-hover);
    }
    .file-meta {
      flex: 1;
      min-width: 0;
    }
    .file-name-title {
      font-weight: 600;
      font-size: 0.95rem;
      color: var(--text-main);
      word-break: break-all;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin: 0;
    }
    .file-size-subtitle {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin: 2px 0 0;
    }
    .info-alert {
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(30, 144, 255, 0.08);
      border: 1px solid rgba(30, 144, 255, 0.2);
      padding: 12px 16px;
      border-radius: 12px;
      margin-bottom: 24px;
      width: 100%;
      text-align: left;
    }
    .info-svg-icon {
      width: 18px;
      height: 18px;
      color: #1e90ff;
      flex-shrink: 0;
    }
    .info-text {
      font-size: 0.85rem;
      color: #79b7ff;
      font-weight: 500;
      margin: 0;
      line-height: 1.4;
    }
    .password-form {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .action-btn {
      width: 100%;
      height: 48px;
    }
    .btn-icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }
    .tag-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
      margin-bottom: 24px;
      width: 100%;
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
    .footer {
      padding: 20px 0;
      border-top: 1px solid var(--glass-border);
      width: 100%;
      text-align: left;
    }
    .footer-text {
      font-size: 0.8rem;
      color: var(--text-muted);
      font-weight: 500;
      margin: 0;
      opacity: 0.6;
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
    @media (max-width: 576px) {
      .page-layout {
        padding: 16px;
      }
      .loading-card, .status-card, .download-card {
        padding: 24px;
      }
      .logo {
        font-size: 1.5rem;
      }
    }
  `]
})
export class DownloadComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly fileService = inject(FileService);
  private readonly fb = inject(FormBuilder);
  readonly authService = inject(AuthService);

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
        this.state.set('READY');
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

  logout(): void {
    this.authService.logout();
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
