import { TestBed, ComponentFixture } from '@angular/core/testing';
import { DownloadComponent } from './download.component';
import { FileService } from '../file.service';
import { ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';

describe('DownloadComponent', () => {
  let component: DownloadComponent;
  let fixture: ComponentFixture<DownloadComponent>;
  let fileServiceMock: any;
  let activatedRouteMock: any;

  const mockFile = {
    uuid: 'uuid-123',
    originalName: 'test.pdf',
    fileType: 'application/pdf',
    fileSize: 1024,
    uploadDate: '2026-06-08T12:00:00Z',
    expiryDate: '2026-06-15T12:00:00Z',
    isExpired: false,
    isPasswordProtected: false,
    tags: ['doc']
  };

  beforeEach(async () => {
    fileServiceMock = {
      getFileDetails: vi.fn(),
      downloadFileBlob: vi.fn()
    };

    activatedRouteMock = {
      snapshot: {
        paramMap: {
          get: vi.fn().mockReturnValue('uuid-123')
        }
      }
    };

    await TestBed.configureTestingModule({
      imports: [DownloadComponent, ReactiveFormsModule],
      providers: [
        provideRouter([]),
        { provide: FileService, useValue: fileServiceMock },
        { provide: ActivatedRoute, useValue: activatedRouteMock }
      ]
    }).compileComponents();
  });

  it('should create and load details on init (unprotected file)', () => {
    fileServiceMock.getFileDetails.mockReturnValue(of(mockFile));
    
    fixture = TestBed.createComponent(DownloadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(fileServiceMock.getFileDetails).toHaveBeenCalledWith('uuid-123');
    expect(component.state()).toBe('READY');
    expect(component.fileDetails()).toEqual(mockFile);
  });

  it('should switch to PASSWORD_PROMPT if file is password protected', () => {
    const protectedFile = { ...mockFile, isPasswordProtected: true };
    fileServiceMock.getFileDetails.mockReturnValue(of(protectedFile));

    fixture = TestBed.createComponent(DownloadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.state()).toBe('PASSWORD_PROMPT');
  });

  it('should switch to ERROR state if details fetch fails', () => {
    fileServiceMock.getFileDetails.mockReturnValue(throwError(() => ({ error: { message: 'Expired link' } })));

    fixture = TestBed.createComponent(DownloadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.state()).toBe('ERROR');
    expect(component.errorMessage()).toBe('Expired link');
  });

  it('should download blob successfully when triggerDownload is called', () => {
    fileServiceMock.getFileDetails.mockReturnValue(of(mockFile));
    const mockBlob = new Blob(['content'], { type: 'application/pdf' });
    fileServiceMock.downloadFileBlob.mockReturnValue(of(mockBlob));

    const createObjectURLSpy = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:url');
    const revokeObjectURLSpy = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});

    fixture = TestBed.createComponent(DownloadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.triggerDownload();

    expect(fileServiceMock.downloadFileBlob).toHaveBeenCalledWith('uuid-123', undefined);
    expect(createObjectURLSpy).toHaveBeenCalledWith(mockBlob);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:url');
    expect(component.downloading()).toBe(false);
  });

  it('should show password error when password download fails', () => {
    const protectedFile = { ...mockFile, isPasswordProtected: true };
    fileServiceMock.getFileDetails.mockReturnValue(of(protectedFile));
    fileServiceMock.downloadFileBlob.mockReturnValue(throwError(() => ({ error: { message: 'Invalid pwd' } })));

    fixture = TestBed.createComponent(DownloadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.passwordForm.setValue({ password: 'wrong' });
    component.onPasswordSubmit();

    expect(fileServiceMock.downloadFileBlob).toHaveBeenCalledWith('uuid-123', 'wrong');
    expect(component.passwordError()).toBe('Mot de passe incorrect. Veuillez réessayer.');
    expect(component.downloading()).toBe(false);
  });
});
