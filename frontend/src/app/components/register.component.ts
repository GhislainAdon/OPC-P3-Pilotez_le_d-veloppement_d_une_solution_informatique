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
              <label for="firstName" class="form-label">Prénom</label>
              <input id="firstName" type="text" formControlName="firstName" class="form-control" placeholder="Jean" aria-label="Prénom"/>
            </div>
            <div class="form-group flex-1">
              <label for="lastName" class="form-label">Nom</label>
              <input id="lastName" type="text" formControlName="lastName" class="form-control" placeholder="Dupont" aria-label="Nom"/>
            </div>
          </div>

          <div class="form-group">
            <label for="email" class="form-label">Email</label>
            <input 
              id="email"
              type="email" 
              formControlName="email" 
              class="form-control" 
              placeholder="jean.dupont@domain.com"
              [class.invalid]="isFieldInvalid('email')"
              [attr.aria-invalid]="isFieldInvalid('email')"
              aria-describedby="email-error"
            />
            <span id="email-error" class="error-msg" *ngIf="isFieldInvalid('email')" role="alert">
              Veuillez saisir un email valide.
            </span>
          </div>

          <div class="form-group">
            <label for="password" class="form-label">Mot de passe</label>
            <input 
              id="password"
              type="password" 
              formControlName="password" 
              class="form-control" 
              placeholder="Min. 8 caractères"
              [class.invalid]="isFieldInvalid('password')"
              [attr.aria-invalid]="isFieldInvalid('password')"
              aria-describedby="password-error"
            />
            <span id="password-error" class="error-msg" *ngIf="isFieldInvalid('password')" role="alert">
              Le mot de passe doit comporter au moins 8 caractères.
            </span>
          </div>

          <div class="form-group privacy-group">
            <label class="checkbox-label" for="privacyConsent">
              <input type="checkbox" id="privacyConsent" formControlName="privacyConsent" />
              <span>J'accepte la <a routerLink="/privacy" class="auth-link">politique de confidentialité</a> et le traitement de mes données personnelles.</span>
            </label>
            <span class="error-msg" *ngIf="isFieldInvalid('privacyConsent')" role="alert">
              Vous devez accepter la politique de confidentialité pour vous inscrire.
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
      font-weight: 800;
      font-size: 2.2rem;
      margin-bottom: 8px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-align: center;
    }
    .auth-subtitle {
      color: var(--text-muted);
      text-align: center;
      font-size: 0.95rem;
      margin-bottom: 32px;
      font-weight: 500;
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
      color: var(--primary);
      font-size: 0.8rem;
      margin-top: 4px;
      font-weight: 500;
    }
    .invalid {
      border-color: rgba(232, 93, 104, 0.4) !important;
    }
    .error-banner {
      background: rgba(232, 93, 104, 0.08);
      border: 1px solid var(--primary);
      color: var(--text-main);
      padding: 12px;
      border-radius: 12px;
      font-size: 0.9rem;
      text-align: center;
      font-weight: 500;
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
    .privacy-group {
      margin-top: 10px;
    }
    .checkbox-label {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 0.85rem;
      color: var(--text-muted);
      cursor: pointer;
    }
    .checkbox-label input[type="checkbox"] {
      margin-top: 4px;
      accent-color: var(--primary);
    }
    .checkbox-label span {
      line-height: 1.4;
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
    lastName: [''],
    privacyConsent: [false, Validators.requiredTrue]
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
