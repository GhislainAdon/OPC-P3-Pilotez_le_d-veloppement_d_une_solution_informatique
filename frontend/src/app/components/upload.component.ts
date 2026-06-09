import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import { FileService, FileResponse } from '../file.service';
import { AuthService } from '../auth.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="upload-container animate-fade-in">
      <div class="glass-panel main-card">
        
        <!-- Welcome header -->
        <header class="header">
          <h1 class="logo" routerLink="/">DataShare</h1>
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
            <button *ngIf="!authService.isLoggedIn()" routerLink="/login" class="btn-primary nav-btn">
              Se connecter
            </button>
          </nav>
        </header>

        <div class="card-content">
          <!-- Left side: Upload settings -->
          <div class="settings-panel" [class.disabled]="uploadState() !== 'IDLE'">
            <h3 class="section-title">Options de partage</h3>
            <form [formGroup]="uploadForm" class="settings-form">
              
              <div class="form-group">
                <label class="form-label">Durée de validité (jours)</label>
                <div class="slider-wrapper">
                  <input type="range" min="1" max="7" formControlName="expiryDays" class="range-slider" />
                  <span class="slider-value">{{ uploadForm.value.expiryDays }} jours</span>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Protection par mot de passe</label>
                <input 
                  type="password" 
                  formControlName="password" 
                  class="form-control" 
                  placeholder="Laisser vide pour aucun"
                />
              </div>

              <div class="form-group">
                <label class="form-label">Tags (Séparés par des virgules)</label>
                <input 
                  type="text" 
                  formControlName="tags" 
                  class="form-control" 
                  placeholder="travail, pdf, important"
                />
              </div>
            </form>
          </div>

          <!-- Right side: Dropzone or Progress or Result -->
          <div class="drop-panel">
            <!-- IDLE State Dropzone -->
            <div 
              *ngIf="uploadState() === 'IDLE'" 
              class="drop-zone"
              [class.drag-over]="isDragOver()"
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave($event)"
              (drop)="onDrop($event)"
              (click)="fileInput.click()"
            >
              <input 
                type="file" 
                #fileInput 
                (change)="onFileSelected($event)" 
                style="display: none;" 
              />
              <div class="drop-icon">📤</div>
              <h3>Glissez-déposez votre fichier ici</h3>
              <p>ou cliquez pour parcourir vos dossiers</p>
              <span class="file-limits">Taille max : 1 Go. Fichiers .exe/.bat interdits.</span>
            </div>

            <!-- UPLOADING State Progress -->
            <div *ngIf="uploadState() === 'UPLOADING'" class="progress-zone">
              <div class="upload-icon-anim">⚡</div>
              <h3>Téléversement en cours...</h3>
              <p class="file-name-progress">{{ selectedFile?.name }}</p>
              
              <div class="progress-bar-container">
                <div class="progress-bar-fill" [style.width.%]="progressPercent()"></div>
              </div>
              <span class="progress-text">{{ progressPercent() }}%</span>
            </div>

            <!-- SUCCESS State Result -->
            <div *ngIf="uploadState() === 'SUCCESS' && uploadResult()" class="success-zone">
              <div class="success-icon">🎉</div>
              <h3>Fichier prêt à être partagé !</h3>
              <p class="success-file-name">{{ uploadResult()?.originalName }}</p>

              <div class="link-box">
                <input type="text" [value]="getDownloadUrl()" readonly #linkInput class="link-input"/>
                <button (click)="copyLink(linkInput)" class="btn-copy">
                  {{ copied() ? 'Copié !' : 'Copier' }}
                </button>
              </div>

              <button (click)="resetUpload()" class="btn-secondary reset-btn">
                Partager un autre fichier
              </button>
            </div>
          </div>
        </div>

        <div class="global-error" *ngIf="errorMessage()">
          {{ errorMessage() }}
        </div>

      </div>
    </div>
  `,
  styles: [`
    .upload-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 120px);
      padding: 24px;
    }
    .main-card {
      width: 100%;
      max-width: 900px;
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
    .card-content {
      display: flex;
      gap: 32px;
      flex-wrap: wrap;
    }
    .settings-panel {
      flex: 1;
      min-width: 280px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      border-right: 1px solid var(--glass-border);
      padding-right: 32px;
    }
    .disabled {
      opacity: 0.5;
      pointer-events: none;
    }
    .section-title {
      font-family: var(--font-title);
      font-weight: 600;
      font-size: 1.2rem;
      margin-bottom: 12px;
    }
    .settings-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .slider-wrapper {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .range-slider {
      flex: 1;
      accent-color: var(--primary);
      height: 6px;
      border-radius: 3px;
      outline: none;
    }
    .slider-value {
      font-weight: 600;
      font-size: 0.9rem;
      min-width: 60px;
    }
    .drop-panel {
      flex: 1.5;
      min-width: 300px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 320px;
    }
    .drop-zone {
      border: 2px dashed var(--glass-border);
      border-radius: 20px;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 40px;
      cursor: pointer;
      transition: all 0.3s ease;
      background: rgba(255, 255, 255, 0.01);
    }
    .drop-zone:hover, .drag-over {
      border-color: var(--primary-hover);
      background: rgba(138, 43, 226, 0.05);
      box-shadow: 0 0 20px rgba(138, 43, 226, 0.1);
    }
    .drop-icon {
      font-size: 3.5rem;
      margin-bottom: 16px;
      transition: transform 0.3s ease;
    }
    .drop-zone:hover .drop-icon {
      transform: translateY(-8px);
    }
    .file-limits {
      margin-top: 16px;
      font-size: 0.75rem;
      color: var(--text-disabled);
    }
    .progress-zone, .success-zone {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
    }
    .upload-icon-anim {
      font-size: 3.5rem;
      animation: pulse 1.5s infinite ease-in-out;
      margin-bottom: 16px;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 0.6; }
      50% { transform: scale(1.15); opacity: 1; }
    }
    .file-name-progress, .success-file-name {
      font-weight: 600;
      color: var(--text-muted);
      margin: 8px 0 20px;
      word-break: break-all;
      text-align: center;
    }
    .progress-bar-container {
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%);
      transition: width 0.1s linear;
    }
    .progress-text {
      font-size: 0.85rem;
      font-weight: 600;
    }
    .success-icon {
      font-size: 4rem;
      margin-bottom: 16px;
    }
    .link-box {
      display: flex;
      width: 100%;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--glass-border);
      border-radius: 12px;
      padding: 6px;
      margin-bottom: 24px;
    }
    .link-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: var(--text-main);
      padding: 8px 12px;
      font-size: 0.9rem;
    }
    .btn-copy {
      background: var(--primary);
      border: none;
      color: #fff;
      padding: 8px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.85rem;
      transition: background 0.2s ease;
    }
    .btn-copy:hover {
      background: var(--primary-hover);
    }
    .reset-btn {
      width: 100%;
    }
    .global-error {
      background: rgba(255, 0, 127, 0.1);
      border: 1px solid var(--accent);
      color: var(--text-main);
      padding: 12px;
      border-radius: 12px;
      font-size: 0.9rem;
      text-align: center;
      width: 100%;
    }
    @media (max-width: 768px) {
      .settings-panel {
        border-right: none;
        border-bottom: 1px solid var(--glass-border);
        padding-right: 0;
        padding-bottom: 32px;
      }
    }
  `]
})
export class UploadComponent {
  private readonly fileService = inject(FileService);
  protected readonly fb = inject(FormBuilder);
  readonly authService = inject(AuthService);

  readonly uploadForm: FormGroup = this.fb.group({
    expiryDays: [7, [Validators.required, Validators.min(1), Validators.max(7)]],
    password: [''],
    tags: ['']
  });

  readonly uploadState = signal<'IDLE' | 'UPLOADING' | 'SUCCESS'>('IDLE');
  readonly progressPercent = signal<number>(0);
  readonly uploadResult = signal<FileResponse | null>(null);
  readonly copied = signal<boolean>(false);
  readonly errorMessage = signal<string>('');
  readonly isDragOver = signal<boolean>(false);

  selectedFile: File | null = null;

  onFileSelected(event: any): void {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  private handleFile(file: File): void {
    // Basic validation
    const nameLower = file.name.toLowerCase();
    if (nameLower.endsWith('.exe') || nameLower.endsWith('.bat') || nameLower.endsWith('.sh') || nameLower.endsWith('.cmd')) {
      this.errorMessage.set("Erreur: Les fichiers exécutables (.exe, .bat, .sh, .cmd) sont interdits pour des raisons de sécurité.");
      return;
    }

    if (file.size > 1024 * 1024 * 1024) {
      this.errorMessage.set("Erreur: La taille maximale autorisée est de 1 Go.");
      return;
    }

    this.selectedFile = file;
    this.startUpload();
  }

  private startUpload(): void {
    if (!this.selectedFile) return;

    this.uploadState.set('UPLOADING');
    this.progressPercent.set(0);
    this.errorMessage.set('');

    const formValues = this.uploadForm.value;
    const tagNames = formValues.tags
      ? formValues.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0)
      : [];

    this.fileService.uploadFile(
      this.selectedFile,
      formValues.expiryDays,
      formValues.password,
      tagNames
    ).subscribe({
      next: (event: any) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          const percent = Math.round(100 * event.loaded / event.total);
          this.progressPercent.set(percent);
        } else if (event.type === HttpEventType.Response) {
          this.uploadState.set('SUCCESS');
          this.uploadResult.set(event.body);
        }
      },
      error: (err) => {
        this.uploadState.set('IDLE');
        this.errorMessage.set(err.error?.message || "Le téléversement a échoué. Veuillez réessayer.");
      }
    });
  }

  getDownloadUrl(): string {
    if (!this.uploadResult()) return '';
    return `${window.location.origin}/download/${this.uploadResult()?.uuid}`;
  }

  copyLink(inputElement: HTMLInputElement): void {
    inputElement.select();
    inputElement.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(inputElement.value).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  resetUpload(): void {
    this.uploadState.set('IDLE');
    this.uploadResult.set(null);
    this.selectedFile = null;
    this.uploadForm.reset({ expiryDays: 7, password: '', tags: '' });
  }

  logout(): void {
    this.authService.logout();
  }
}
