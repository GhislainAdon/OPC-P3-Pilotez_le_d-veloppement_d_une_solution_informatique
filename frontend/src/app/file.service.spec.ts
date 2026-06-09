import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FileService, FileResponse } from './file.service';
import { HttpEventType, HttpEvent } from '@angular/common/http';

describe('FileService', () => {
  let service: FileService;
  let httpTestingController: HttpTestingController;

  const mockFileResponse: FileResponse = {
    uuid: 'mock-uuid',
    originalName: 'test.txt',
    fileType: 'text/plain',
    fileSize: 1234,
    uploadDate: '2026-06-08T12:00:00Z',
    expiryDate: '2026-06-09T12:00:00Z',
    isExpired: false,
    isPasswordProtected: false,
    tags: ['test', 'doc']
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FileService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(FileService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get file details by uuid', () => {
    service.getFileDetails('mock-uuid').subscribe(res => {
      expect(res).toEqual(mockFileResponse);
    });

    const req = httpTestingController.expectOne('http://localhost:8080/api/files/download/mock-uuid/details');
    expect(req.request.method).toBe('GET');
    req.flush(mockFileResponse);
  });

  it('should download file blob', () => {
    const mockBlob = new Blob(['hello world'], { type: 'text/plain' });

    service.downloadFileBlob('mock-uuid', 'my-password').subscribe(res => {
      expect(res).toEqual(mockBlob);
    });

    const req = httpTestingController.expectOne(request => 
      request.url === 'http://localhost:8080/api/files/download/mock-uuid' &&
      request.params.get('password') === 'my-password'
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(mockBlob);
  });

  it('should get file upload history', () => {
    const mockHistory: FileResponse[] = [mockFileResponse];

    service.getHistory().subscribe(res => {
      expect(res).toEqual(mockHistory);
    });

    const req = httpTestingController.expectOne('http://localhost:8080/api/files/history');
    expect(req.request.method).toBe('GET');
    req.flush(mockHistory);
  });

  it('should delete a file by uuid', () => {
    service.deleteFile('mock-uuid').subscribe(() => {
      // Success case
    });

    const req = httpTestingController.expectOne('http://localhost:8080/api/files/mock-uuid');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('should upload a file and report progress events', () => {
    const file = new File(['file content'], 'test.txt', { type: 'text/plain' });

    service.uploadFile(file, 3, 'pwd123', ['tag1']).subscribe((event: HttpEvent<FileResponse>) => {
      if (event.type === HttpEventType.Response) {
        expect(event.body).toEqual(mockFileResponse);
      }
    });

    const req = httpTestingController.expectOne('http://localhost:8080/api/files/upload');
    expect(req.request.method).toBe('POST');
    
    const formData: FormData = req.request.body;
    expect(formData.get('file')).toEqual(file);
    expect(formData.get('expiryDays')).toBe('3');
    expect(formData.get('password')).toBe('pwd123');
    expect(formData.getAll('tags')).toEqual(['tag1']);

    req.flush(mockFileResponse);
  });
});
