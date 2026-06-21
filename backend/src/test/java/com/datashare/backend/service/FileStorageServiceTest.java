package com.datashare.backend.service;

import com.datashare.backend.exception.AppException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class FileStorageServiceTest {

    @TempDir
    Path tempDir;

    private FileStorageService fileStorageService;
    private FileValidationService fileValidationService;

    @BeforeEach
    void setUp() {
        fileValidationService = new FileValidationService();
        fileStorageService = new FileStorageService(tempDir.toString(), fileValidationService);
        fileStorageService.init();
    }

    @Test
    void init_CreatesDirectory() {
        assertTrue(Files.exists(tempDir));
    }

    @Test
    @DisplayName("storeFile : stocke un fichier valide et renvoie chemin + MIME détecté")
    void storeFile_Success() throws IOException {
        String uuid = UUID.randomUUID().toString();
        MockMultipartFile mockFile = new MockMultipartFile(
                "file",
                "test-file.txt",
                "text/plain",
                "Hello World".getBytes()
        );

        StoredFile stored = fileStorageService.storeFile(mockFile, uuid);

        assertNotNull(stored);
        assertNotNull(stored.storagePath());
        assertNotNull(stored.detectedMimeType());

        Path targetPath = Path.of(stored.storagePath());
        assertTrue(Files.exists(targetPath));
        assertEquals("Hello World", Files.readString(targetPath));
        assertTrue(targetPath.getFileName().toString().startsWith(uuid));
        // Le type MIME détecté par Tika pour un .txt doit commencer par text/
        assertTrue(stored.detectedMimeType().startsWith("text/"),
                "Type MIME détecté attendu : text/*, était : " + stored.detectedMimeType());
    }

    @Test
    @DisplayName("storeFile : rejet d'un .exe par la validation (avant écriture sur disque)")
    void storeFile_ExeRejected_ByValidation() {
        String uuid = UUID.randomUUID().toString();
        MockMultipartFile mockFile = new MockMultipartFile(
                "file",
                "malware.exe",
                "application/x-msdownload",
                "MZ fake exe".getBytes()
        );

        AppException exception = assertThrows(AppException.class, () ->
                fileStorageService.storeFile(mockFile, uuid)
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatus());
        // Vérifier que RIEN n'a été écrit sur disque
        try (var files = Files.list(tempDir)) {
            assertEquals(0, files.count(), "Aucun fichier ne doit être écrit sur disque après rejet");
        } catch (IOException e) {
            fail(e);
        }
    }

    @Test
    @DisplayName("storeFile : rejet d'un path traversal (..) avec 400")
    void storeFile_ThrowsException_OnInvalidPath() {
        String uuid = UUID.randomUUID().toString();
        // .txt est en liste blanche donc la validation d'extension passe,
        // mais le check de path traversal dans FileStorageService doit encore s'appliquer.
        MockMultipartFile mockFile = new MockMultipartFile(
                "file",
                "../test-file.txt",
                "text/plain",
                "Hello World".getBytes()
        );

        AppException exception = assertThrows(AppException.class, () ->
                fileStorageService.storeFile(mockFile, uuid)
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatus());
        assertTrue(exception.getMessage().contains("invalid path sequence"));
    }

    @Test
    void loadFileAsResource_Success() throws IOException {
        Path dummyFile = tempDir.resolve("dummy.txt");
        Files.writeString(dummyFile, "Mock file contents");

        Resource resource = fileStorageService.loadFileAsResource(dummyFile.toString());

        assertNotNull(resource);
        assertTrue(resource.exists());
        assertTrue(resource.isReadable());
        assertEquals(dummyFile.toUri(), resource.getURI());
    }

    @Test
    @DisplayName("loadFileAsResource : rejet d'un path traversal hors du répertoire de stockage")
    void loadFileAsResource_RejectsPathTraversal() throws IOException {
        // Tente d'accéder à /etc/passwd via un chemin absolu hors du répertoire de stockage
        Path outside = Path.of("/etc/passwd");

        AppException exception = assertThrows(AppException.class, () ->
                fileStorageService.loadFileAsResource(outside.toString())
        );

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatus());
    }

    @Test
    void loadFileAsResource_ThrowsException_WhenFileNotFound() {
        Path nonExistent = tempDir.resolve("missing.txt");

        AppException exception = assertThrows(AppException.class, () ->
                fileStorageService.loadFileAsResource(nonExistent.toString())
        );

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatus());
    }

    @Test
    void deletePhysicalFile_Success() throws IOException {
        Path dummyFile = tempDir.resolve("dummy-delete.txt");
        Files.writeString(dummyFile, "To be deleted");
        assertTrue(Files.exists(dummyFile));

        fileStorageService.deletePhysicalFile(dummyFile.toString());

        assertFalse(Files.exists(dummyFile));
    }

    @Test
    @DisplayName("deletePhysicalFile : ne supprime rien hors du répertoire de stockage (path traversal)")
    void deletePhysicalFile_RejectsPathTraversal() throws IOException {
        Path outside = Path.of("/tmp/should-not-be-deleted-" + UUID.randomUUID() + ".txt");
        Files.writeString(outside, "important");
        try {
            fileStorageService.deletePhysicalFile(outside.toString());
            // Le fichier ne doit pas avoir été supprimé
            assertTrue(Files.exists(outside), "Le fichier hors répertoire de stockage ne doit pas être supprimé");
        } finally {
            Files.deleteIfExists(outside);
        }
    }
}
