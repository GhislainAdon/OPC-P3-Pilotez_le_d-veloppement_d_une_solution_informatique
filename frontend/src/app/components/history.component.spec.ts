import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HistoryComponent } from './history.component';
import { FileService } from '../file.service';
import { AuthService } from '../auth.service';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';

describe('HistoryComponent', () => {
  let component: HistoryComponent;
  let fixture: ComponentFixture<HistoryComponent>;
  let fileServiceMock: any;
  let authServiceMock: any;

  const mockFiles = [
    {
      uuid: 'uuid-1',
      originalName: 'test1.pdf',
      fileType: 'application/pdf',
      fileSize: 2048,
      uploadDate: '2026-06-08T12:00:00Z',
      expiryDate: '2026-06-15T12:00:00Z',
      isExpired: false,
      isPasswordProtected: false,
      tags: ['doc']
    },
    {
      uuid: 'uuid-2',
      originalName: 'test2.zip',
      fileType: 'application/zip',
      fileSize: 1048576,
      uploadDate: '2026-06-08T12:00:00Z',
      expiryDate: '2026-06-10T12:00:00Z',
      isExpired: false,
      isPasswordProtected: true,
      tags: ['archive', 'zip']
    }
  ];

  beforeEach(async () => {
    fileServiceMock = {
      getHistory: vi.fn().mockReturnValue(of(mockFiles)),
      deleteFile: vi.fn()
    };

    authServiceMock = {
      currentUser: signal({ email: 'test@example.com', firstName: 'John' }),
      logout: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [HistoryComponent],
      providers: [
        { provide: FileService, useValue: fileServiceMock },
        { provide: AuthService, useValue: authServiceMock },
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load file history on init', () => {
    expect(component).toBeTruthy();
    expect(fileServiceMock.getHistory).toHaveBeenCalled();
    expect(component.files()).toEqual(mockFiles);
    expect(component.loading()).toBe(false);
  });

  it('should format bytes correctly', () => {
    expect(component.formatBytes(0)).toBe('0 Octets');
    expect(component.formatBytes(512)).toBe('512 Octets');
    expect(component.formatBytes(2048)).toBe('2 Ko');
    expect(component.formatBytes(1048576)).toBe('1 Mo');
  });

  it('should handle file deletion when confirmed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fileServiceMock.deleteFile.mockReturnValue(of(null));

    component.deleteFile('uuid-1');

    expect(window.confirm).toHaveBeenCalled();
    expect(fileServiceMock.deleteFile).toHaveBeenCalledWith('uuid-1');
    expect(component.files().length).toBe(1);
    expect(component.files()[0].uuid).toBe('uuid-2');
  });

  it('should not delete file when not confirmed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    component.deleteFile('uuid-1');

    expect(window.confirm).toHaveBeenCalled();
    expect(fileServiceMock.deleteFile).not.toHaveBeenCalled();
    expect(component.files().length).toBe(2);
  });
});
