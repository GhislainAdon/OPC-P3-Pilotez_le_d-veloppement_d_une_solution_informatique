import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-wrapper animate-fade-in">
      <div class="glass-panel auth-card">
        <h2 class="auth-title">Inscription</h2>
        <p class="auth-subtitle">Créez votre compte gratuit DataShare</p>

        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" class="auth-form">
          <div class="name-row">
            <div class="form-group flex-1">
              <label class="form-label">Prénom</label>
              <input type="text" formControlName="firstName" class="form-control" placeholder="Jean"/>
            </div>
            <div class="form-group flex-1">
              <label class="form-label">Nom</label>
              <input type="text" formControlName="lastName" class="form-control" placeholder="Dupont"/>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Email</label>
            <input 
              type="email" 
              formControlName="email" 
              class="form-control" 
              placeholder="jean.dupont@domain.com"
              [class.invalid]="isFieldInvalid('email')"
            />
            <span class="error-msg" *ngIf="isFieldInvalid('email')">
              Veuillez saisir un email valide.
            </span>
          </div>

          <div class="form-group">
            <label class="form-label">Mot de passe</label>
            <input 
              type="password" 
              formControlName="password" 
              class="form-control" 
              placeholder="Min. 8 caractères"
              [class.invalid]="isFieldInvalid('password')"
            />
            <span class="error-msg" *ngIf="isFieldInvalid('password')">
              Le mot de passe doit comporter au moins 8 caractères.
            </span>
          </div>

          <div class="error-banner" *ngIf="errorMessage">
            {{ errorMessage }}
          </div>

          <button type="submit" [disabled]="registerForm.invalid || loading" class="btn-primary auth-btn">
            <span *ngIf="!loading">Créer mon compte</span>
            <span *ngIf="loading" class="spinner"></span>
          </button>
        </form>

        <div class="auth-footer">
          Déjà un compte ? <a routerLink="/login" class="auth-link">Se connecter</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 120px);
      padding: 20px;
    }
    .auth-card {
      width: 100%;
      max-width: 500px;
      padding: 40px;
    }
    .auth-title {
      font-family: var(--font-title);
      font-weight: 700;
      font-size: 2rem;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #fff 0%, var(--text-muted) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-align: center;
    }
    .auth-subtitle {
      color: var(--text-muted);
      text-align: center;
      font-size: 0.95rem;
      margin-bottom: 32px;
    }
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .name-row {
      display: flex;
      gap: 16px;
    }
    .flex-1 {
      flex: 1;
    }
    .error-msg {
      color: var(--accent);
      font-size: 0.8rem;
      margin-top: 4px;
    }
    .invalid {
      border-color: rgba(255, 0, 127, 0.4) !important;
    }
    .error-banner {
      background: rgba(255, 0, 127, 0.1);
      border: 1px solid var(--accent);
      color: var(--text-main);
      padding: 12px;
      border-radius: 12px;
      font-size: 0.9rem;
      text-align: center;
    }
    .auth-btn {
      width: 100%;
      height: 48px;
      margin-top: 10px;
    }
    .auth-footer {
      margin-top: 24px;
      text-align: center;
      font-size: 0.9rem;
      color: var(--text-muted);
    }
    .auth-link {
      color: var(--primary-hover);
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s ease;
    }
    .auth-link:hover {
      color: var(--text-main);
      text-decoration: underline;
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
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly registerForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    firstName: [''],
    lastName: ['']
  });

  loading = false;
  errorMessage = '';

  isFieldInvalid(field: string): boolean {
    const control = this.registerForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  onSubmit(): void {
    if (this.registerForm.invalid) return;

    this.loading = true;
    this.errorMessage = '';

    this.authService.register(this.registerForm.value).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || "Une erreur s'est produite lors de l'inscription.";
      }
    });
  }
}
