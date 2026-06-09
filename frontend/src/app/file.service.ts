import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface FileResponse {
  uuid: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  uploadDate: string;
  expiryDate: string;
  isExpired: boolean;
  isPasswordProtected: boolean;
  tags: string[];
}

@Injectable({
  providedIn: 'root'
})
export class FileService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/files';

  uploadFile(
    file: File,
    expiryDays?: number,
    password?: string,
    tags?: string[]
  ): Observable<HttpEvent<FileResponse>> {
    const formData = new FormData();
    formData.append('file', file);
    if (expiryDays !== undefined) {
      formData.append('expiryDays', expiryDays.toString());
    }
    if (password) {
      formData.append('password', password);
    }
    if (tags && tags.length > 0) {
      tags.forEach(tag => formData.append('tags', tag));
    }

    const req = new HttpRequest('POST', `${this.apiUrl}/upload`, formData, {
      reportProgress: true,
      responseType: 'json'
    });

    return this.http.request<FileResponse>(req);
  }

  getFileDetails(uuid: string): Observable<FileResponse> {
    return this.http.get<FileResponse>(`${this.apiUrl}/download/${uuid}/details`);
  }

  downloadFileBlob(uuid: string, password?: string): Observable<Blob> {
    const params: any = {};
    if (password) {
      params.password = password;
    }
    return this.http.get(`${this.apiUrl}/download/${uuid}`, {
      params,
      responseType: 'blob'
    });
  }

  getHistory(): Observable<FileResponse[]> {
    return this.http.get<FileResponse[]>(`${this.apiUrl}/history`);
  }

  deleteFile(uuid: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${uuid}`);
  }
}
