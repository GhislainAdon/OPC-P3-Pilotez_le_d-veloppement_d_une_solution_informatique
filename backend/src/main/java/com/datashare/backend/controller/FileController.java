package com.datashare.backend.controller;

import com.datashare.backend.dto.FileResponse;
import com.datashare.backend.service.FileMetadataService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLConnection;
import java.util.List;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final FileMetadataService fileMetadataService;

    @PostMapping("/upload")
    public ResponseEntity<FileResponse> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "expiryDays", required = false) Integer expiryDays,
            @RequestParam(value = "password", required = false) String password,
            @RequestParam(value = "tags", required = false) List<String> tags
    ) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String email = null;
        if (authentication != null && authentication.isAuthenticated() && !"anonymousUser".equals(authentication.getPrincipal())) {
            email = authentication.getName();
        }

        FileResponse response = fileMetadataService.uploadFile(file, expiryDays, password, tags, email);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/download/{uuid}/details")
    public ResponseEntity<FileResponse> getFileDetails(@PathVariable String uuid) {
        return ResponseEntity.ok(fileMetadataService.getFileDetails(uuid));
    }

    @GetMapping("/download/{uuid}")
    public ResponseEntity<Resource> downloadFile(
            @PathVariable String uuid,
            @RequestParam(value = "password", required = false) String password
    ) {
        Resource resource = fileMetadataService.downloadFile(uuid, password);
        FileResponse details = fileMetadataService.getFileDetails(uuid);

        String contentType = details.fileType();
        if (contentType == null || contentType.isBlank()) {
            contentType = URLConnection.guessContentTypeFromName(details.originalName());
            if (contentType == null) {
                contentType = "application/octet-stream";
            }
        }

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + details.originalName() + "\"")
                .body(resource);
    }

    @GetMapping("/history")
    public ResponseEntity<List<FileResponse>> getHistory() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String email = authentication.getName();
        return ResponseEntity.ok(fileMetadataService.getUserHistory(email));
    }

    @DeleteMapping("/{uuid}")
    public ResponseEntity<Void> deleteFile(@PathVariable String uuid) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String email = authentication.getName();
        fileMetadataService.deleteFile(uuid, email);
        return ResponseEntity.noContent().build();
    }
}
