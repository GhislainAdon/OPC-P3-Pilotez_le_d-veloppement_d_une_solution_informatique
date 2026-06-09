package com.datashare.backend.service;

import com.datashare.backend.exception.AppException;
import org.junit.jupiter.api.BeforeEach;
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

    @BeforeEach
    void setUp() {
        fileStorageService = new FileStorageService(tempDir.toString());
        fileStorageService.init();
    }

    @Test
    void init_CreatesDirectory() {
        assertTrue(Files.exists(tempDir));
    }

    @Test
    void storeFile_Success() throws IOException {
        String uuid = UUID.randomUUID().toString();
        MockMultipartFile mockFile = new MockMultipartFile(
                "file",
                "test-file.txt",
                "text/plain",
                "Hello World".getBytes()
        );

        String storedPath = fileStorageService.storeFile(mockFile, uuid);

        assertNotNull(storedPath);
        Path targetPath = Path.of(storedPath);
        assertTrue(Files.exists(targetPath));
        assertEquals("Hello World", Files.readString(targetPath));
        assertTrue(targetPath.getFileName().toString().startsWith(uuid));
    }

    @Test
    void storeFile_ThrowsException_OnInvalidPath() {
        String uuid = UUID.randomUUID().toString();
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
}
