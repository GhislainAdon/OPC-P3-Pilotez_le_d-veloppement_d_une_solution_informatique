import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService, UserResponse } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(AuthService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should register a user, save session, and update currentUser signal', () => {
    const mockUser: UserResponse = {
      token: 'mock-jwt-token',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe'
    };

    const registerData = {
      email: 'test@example.com',
      password: 'password',
      firstName: 'John',
      lastName: 'Doe'
    };

    service.register(registerData).subscribe(res => {
      expect(res).toEqual(mockUser);
      expect(service.currentUser()).toEqual(mockUser);
      expect(service.isLoggedIn()).toBe(true);
      expect(localStorage.getItem('token')).toBe('mock-jwt-token');
      expect(localStorage.getItem('user')).toContain('test@example.com');
    });

    const req = httpTestingController.expectOne('http://localhost:8080/api/auth/register');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(registerData);
    req.flush(mockUser);
  });

  it('should login a user, save session, and update currentUser signal', () => {
    const mockUser: UserResponse = {
      token: 'mock-jwt-token',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe'
    };

    const loginData = {
      email: 'test@example.com',
      password: 'password'
    };

    service.login(loginData).subscribe(res => {
      expect(res).toEqual(mockUser);
      expect(service.currentUser()).toEqual(mockUser);
      expect(service.isLoggedIn()).toBe(true);
      expect(localStorage.getItem('token')).toBe('mock-jwt-token');
    });

    const req = httpTestingController.expectOne('http://localhost:8080/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(loginData);
    req.flush(mockUser);
  });

  it('should logout a user and clear session', () => {
    const mockUser: UserResponse = {
      token: 'mock-jwt-token',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe'
    };

    localStorage.setItem('token', mockUser.token);
    localStorage.setItem('user', JSON.stringify(mockUser));
    
    // Re-initialize service to pick up localStorage data
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(AuthService);
    expect(service.isLoggedIn()).toBe(true);
    expect(service.currentUser()).toEqual(mockUser);

    service.logout();
    expect(service.isLoggedIn()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});
