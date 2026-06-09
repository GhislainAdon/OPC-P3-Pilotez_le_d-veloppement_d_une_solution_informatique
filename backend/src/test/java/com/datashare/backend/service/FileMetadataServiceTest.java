package com.datashare.backend.service;

import com.datashare.backend.dto.FileResponse;
import com.datashare.backend.exception.AppException;
import com.datashare.backend.exception.ResourceNotFoundException;
import com.datashare.backend.exception.UnauthorizedException;
import com.datashare.backend.model.FileMetadata;
import com.datashare.backend.model.Tag;
import com.datashare.backend.model.User;
import com.datashare.backend.repository.FileMetadataRepository;
import com.datashare.backend.repository.TagRepository;
import com.datashare.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FileMetadataServiceTest {

    @Mock
    private FileMetadataRepository fileMetadataRepository;

    @Mock
    private TagRepository tagRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private FileMetadataService fileMetadataService;

    private User testUser;
    private FileMetadata fileMetadata;
    private MockMultipartFile mockFile;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .id(10L)
                .email("user@example.com")
                .firstName("Alice")
                .lastName("Smith")
                .build();

        fileMetadata = FileMetadata.builder()
                .id(1L)
                .uuid("test-uuid-123")
                .originalName("test-file.png")
                .fileType("image/png")
                .fileSize(100L)
                .storagePath("/app/uploads/test-uuid-123_test-file.png")
                .uploadDate(Instant.now())
                .expiryDate(Instant.now().plus(7, ChronoUnit.DAYS))
                .isExpired(false)
                .user(testUser)
                .tags(new HashSet<>(Collections.singletonList(new Tag(1L, "images"))))
                .build();

        mockFile = new MockMultipartFile(
                "file",
                "test-file.png",
                "image/png",
                new byte[100]
        );
    }

    @Test
    void uploadFile_AnonymousUser_NoPassword_Success() {
        when(fileStorageService.storeFile(any(), anyString())).thenReturn("/app/uploads/test-uuid-123_test-file.png");
        when(tagRepository.findByName("images")).thenReturn(Optional.empty());
        when(tagRepository.save(any(Tag.class))).thenReturn(new Tag(1L, "images"));
        when(fileMetadataRepository.save(any(FileMetadata.class))).thenAnswer(invocation -> {
            FileMetadata meta = invocation.getArgument(0);
            meta.setId(1L);
            return meta;
        });

        FileResponse response = fileMetadataService.uploadFile(
                mockFile,
                5,
                null,
                Collections.singletonList("images"),
                null
        );

        assertNotNull(response);
        assertEquals("test-file.png", response.originalName());
        assertEquals("image/png", response.fileType());
        assertFalse(response.isPasswordProtected());
        assertTrue(response.tags().contains("images"));
        verify(userRepository, never()).findByEmail(anyString());
    }

    @Test
    void uploadFile_AuthenticatedUser_WithPassword_Success() {
        when(fileStorageService.storeFile(any(), anyString())).thenReturn("/app/uploads/test-uuid-123_test-file.png");
        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(testUser));
        when(passwordEncoder.encode("secret123")).thenReturn("hashed_password");
        when(tagRepository.findByName("images")).thenReturn(Optional.empty());
        when(tagRepository.save(any(Tag.class))).thenReturn(new Tag(1L, "images"));
        when(fileMetadataRepository.save(any(FileMetadata.class))).thenAnswer(invocation -> {
            FileMetadata meta = invocation.getArgument(0);
            meta.setId(1L);
            return meta;
        });

        FileResponse response = fileMetadataService.uploadFile(
                mockFile,
                3,
                "secret123",
                Collections.singletonList("images"),
                "user@example.com"
        );

        assertNotNull(response);
        assertTrue(response.isPasswordProtected());
        verify(userRepository, times(1)).findByEmail("user@example.com");
        verify(passwordEncoder, times(1)).encode("secret123");
    }

    @Test
    void uploadFile_ThrowsException_WhenPasswordTooShort() {
        AppException exception = assertThrows(AppException.class, () ->
                fileMetadataService.uploadFile(mockFile, 7, "123", null, null)
        );

        assertEquals("Password must be at least 6 characters long", exception.getMessage());
        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatus());
    }

    @Test
    void getFileDetails_Success() {
        when(fileMetadataRepository.findByUuid("test-uuid-123")).thenReturn(Optional.of(fileMetadata));

        FileResponse response = fileMetadataService.getFileDetails("test-uuid-123");

        assertNotNull(response);
        assertEquals("test-uuid-123", response.uuid());
        assertEquals("test-file.png", response.originalName());
    }

    @Test
    void getFileDetails_ThrowsException_WhenExpired() {
        fileMetadata.setExpiryDate(Instant.now().minusSeconds(10));
        when(fileMetadataRepository.findByUuid("test-uuid-123")).thenReturn(Optional.of(fileMetadata));

        AppException exception = assertThrows(AppException.class, () ->
                fileMetadataService.getFileDetails("test-uuid-123")
        );

        assertEquals(HttpStatus.GONE, exception.getStatus());
        assertTrue(fileMetadata.getIsExpired());
        verify(fileStorageService, times(1)).deletePhysicalFile(fileMetadata.getStoragePath());
        verify(fileMetadataRepository, times(1)).save(fileMetadata);
    }

    @Test
    void downloadFile_NoPasswordNeeded_Success() {
        fileMetadata.setPasswordHash(null);
        when(fileMetadataRepository.findByUuid("test-uuid-123")).thenReturn(Optional.of(fileMetadata));
        Resource mockResource = new ByteArrayResource("file_contents".getBytes());
        when(fileStorageService.loadFileAsResource(fileMetadata.getStoragePath())).thenReturn(mockResource);

        Resource result = fileMetadataService.downloadFile("test-uuid-123", null);

        assertNotNull(result);
        verify(fileStorageService, times(1)).loadFileAsResource(fileMetadata.getStoragePath());
    }

    @Test
    void downloadFile_PasswordProtected_Success() {
        fileMetadata.setPasswordHash("hashed_password");
        when(fileMetadataRepository.findByUuid("test-uuid-123")).thenReturn(Optional.of(fileMetadata));
        when(passwordEncoder.matches("secret123", "hashed_password")).thenReturn(true);
        Resource mockResource = new ByteArrayResource("file_contents".getBytes());
        when(fileStorageService.loadFileAsResource(fileMetadata.getStoragePath())).thenReturn(mockResource);

        Resource result = fileMetadataService.downloadFile("test-uuid-123", "secret123");

        assertNotNull(result);
    }

    @Test
    void downloadFile_PasswordProtected_ThrowsException_OnIncorrectPassword() {
        fileMetadata.setPasswordHash("hashed_password");
        when(fileMetadataRepository.findByUuid("test-uuid-123")).thenReturn(Optional.of(fileMetadata));
        when(passwordEncoder.matches("wrong_password", "hashed_password")).thenReturn(false);

        assertThrows(UnauthorizedException.class, () ->
                fileMetadataService.downloadFile("test-uuid-123", "wrong_password")
        );
    }

    @Test
    void getUserHistory_Success() {
        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(testUser));
        when(fileMetadataRepository.findByUserAndIsExpiredFalseOrderByUploadDateDesc(testUser))
                .thenReturn(Collections.singletonList(fileMetadata));

        List<FileResponse> history = fileMetadataService.getUserHistory("user@example.com");

        assertNotNull(history);
        assertEquals(1, history.size());
        assertEquals("test-uuid-123", history.get(0).uuid());
    }

    @Test
    void deleteFile_Success() {
        when(fileMetadataRepository.findByUuid("test-uuid-123")).thenReturn(Optional.of(fileMetadata));
        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(testUser));

        fileMetadataService.deleteFile("test-uuid-123", "user@example.com");

        verify(fileStorageService, times(1)).deletePhysicalFile(fileMetadata.getStoragePath());
        verify(fileMetadataRepository, times(1)).delete(fileMetadata);
    }

    @Test
    void deleteFile_ThrowsException_WhenNotOwner() {
        User otherUser = User.builder().id(99L).email("other@example.com").build();
        when(fileMetadataRepository.findByUuid("test-uuid-123")).thenReturn(Optional.of(fileMetadata));
        when(userRepository.findByEmail("other@example.com")).thenReturn(Optional.of(otherUser));

        assertThrows(UnauthorizedException.class, () ->
                fileMetadataService.deleteFile("test-uuid-123", "other@example.com")
        );

        verify(fileStorageService, never()).deletePhysicalFile(anyString());
        verify(fileMetadataRepository, never()).delete(any(FileMetadata.class));
    }

    @Test
    void purgeExpiredFiles_Success() {
        FileMetadata expiredFile = FileMetadata.builder()
                .id(2L)
                .uuid("expired-uuid")
                .storagePath("/app/uploads/expired_file")
                .isExpired(false)
                .expiryDate(Instant.now().minusSeconds(100))
                .build();

        when(fileMetadataRepository.findByIsExpiredFalseAndExpiryDateBefore(any(Instant.now().getClass())))
                .thenReturn(Collections.singletonList(expiredFile));

        fileMetadataService.purgeExpiredFiles();

        verify(fileStorageService, times(1)).deletePhysicalFile("/app/uploads/expired_file");
        assertTrue(expiredFile.getIsExpired());
        verify(fileMetadataRepository, times(1)).save(expiredFile);
    }
}
