import { TestBed, ComponentFixture } from '@angular/core/testing';
import { UploadComponent } from './upload.component';
import { FileService } from '../file.service';
import { AuthService } from '../auth.service';
import { ReactiveFormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { HttpEventType } from '@angular/common/http';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';

describe('UploadComponent', () => {
  let component: UploadComponent;
  let fixture: ComponentFixture<UploadComponent>;
  let fileServiceMock: any;
  let authServiceMock: any;

  beforeEach(async () => {
    fileServiceMock = {
      uploadFile: vi.fn()
    };
    
    authServiceMock = {
      isLoggedIn: vi.fn().mockReturnValue(false),
      currentUser: signal(null),
      logout: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [UploadComponent, ReactiveFormsModule],
      providers: [
        { provide: FileService, useValue: fileServiceMock },
        { provide: AuthService, useValue: authServiceMock },
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should reject executable files (.exe)', () => {
    const file = new File([''], 'malicious.exe', { type: 'application/x-msdownload' });
    component.onFileSelected({ target: { files: [file] } });
    expect(component.errorMessage()).toContain('exécutables (.exe, .bat, .sh, .cmd) sont interdits');
    expect(component.selectedFile).toBeNull();
  });

  it('should reject large files (> 1GB)', () => {
    const largeFile = {
      name: 'large.zip',
      size: 1024 * 1024 * 1024 + 1, // slightly over 1GB
      type: 'application/zip'
    } as any as File;

    component.onFileSelected({ target: { files: [largeFile] } });
    expect(component.errorMessage()).toContain('taille maximale autorisée est de 1 Go');
    expect(component.selectedFile).toBeNull();
  });

  it('should successfully upload a valid file', () => {
    const file = new File(['hello content'], 'test.txt', { type: 'text/plain' });
    const mockResponse = { uuid: 'new-uuid', originalName: 'test.txt' };

    fileServiceMock.uploadFile.mockReturnValue(of({
      type: HttpEventType.Response,
      body: mockResponse
    }));

    component.uploadForm.setValue({
      expiryDays: 5,
      password: 'mypassword',
      tags: 'tag1, tag2'
    });

    component.onFileSelected({ target: { files: [file] } });

    expect(fileServiceMock.uploadFile).toHaveBeenCalledWith(file, 5, 'mypassword', ['tag1', 'tag2']);
    expect(component.uploadState()).toBe('SUCCESS');
    expect(component.uploadResult()).toEqual(mockResponse);
  });

  it('should handle upload failure and reset to IDLE', () => {
    const file = new File(['hello content'], 'test.txt', { type: 'text/plain' });
    const errorResponse = { error: { message: 'Upload failed' } };
    fileServiceMock.uploadFile.mockReturnValue(throwError(() => errorResponse));

    component.onFileSelected({ target: { files: [file] } });

    expect(component.uploadState()).toBe('IDLE');
    expect(component.errorMessage()).toBe('Upload failed');
  });
});
