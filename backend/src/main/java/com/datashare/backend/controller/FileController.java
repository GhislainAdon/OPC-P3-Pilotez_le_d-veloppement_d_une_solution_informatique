package com.datashare.backend.controller;

import com.datashare.backend.dto.FileResponse;
import com.datashare.backend.service.FileMetadataService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import java.nio.charset.StandardCharsets;
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
        // 201 Created : la ressource FileMetadata a été créée côté serveur.
        // Auparavant le code renvoyait 200 OK, en contradiction avec README.md
        // et TESTING.md qui décrivaient un 201. Le comportement est aligné.
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
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

        ContentDisposition contentDisposition = ContentDisposition.attachment()
                .filename(details.originalName(), StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString())
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
