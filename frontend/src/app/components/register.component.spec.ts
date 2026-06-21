import { TestBed, ComponentFixture } from '@angular/core/testing';
import { RegisterComponent } from './register.component';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let authServiceMock: any;
  let router: Router;

  beforeEach(async () => {
    authServiceMock = {
      register: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [RegisterComponent, ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockImplementation(async () => true);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should validate form fields', () => {
    const emailControl = component.registerForm.get('email');
    const passwordControl = component.registerForm.get('password');

    expect(emailControl?.valid).toBe(false);
    emailControl?.setValue('invalid-email');
    expect(emailControl?.valid).toBe(false);
    emailControl?.setValue('test@example.com');
    expect(emailControl?.valid).toBe(true);

    expect(passwordControl?.valid).toBe(false);
    passwordControl?.setValue('1234567'); // under 8 chars
    expect(passwordControl?.valid).toBe(false);
    passwordControl?.setValue('12345678');
    expect(passwordControl?.valid).toBe(true);
  });

  it('should call authService.register on submit and navigate on success', () => {
    authServiceMock.register.mockReturnValue(of({ token: 'test-token' }));

    component.registerForm.setValue({
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      privacyConsent: true
    });

    component.onSubmit();

    expect(component.loading).toBe(false);
    expect(authServiceMock.register).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      privacyConsent: true
    });
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should set error message on registration failure', () => {
    const errorResponse = { error: { message: "L'adresse email est déjà utilisée." } };
    authServiceMock.register.mockReturnValue(throwError(() => errorResponse));

    component.registerForm.setValue({
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      privacyConsent: true
    });

    component.onSubmit();

    expect(component.loading).toBe(false);
    expect(component.errorMessage).toBe("L'adresse email est déjà utilisée.");
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
