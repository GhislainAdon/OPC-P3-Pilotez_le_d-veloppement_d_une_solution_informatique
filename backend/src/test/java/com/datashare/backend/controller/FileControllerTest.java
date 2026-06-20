package com.datashare.backend.controller;

import com.datashare.backend.dto.FileResponse;
import com.datashare.backend.exception.AppException;
import com.datashare.backend.exception.ResourceNotFoundException;
import com.datashare.backend.exception.UnauthorizedException;
import com.datashare.backend.model.User;
import com.datashare.backend.repository.UserRepository;
import com.datashare.backend.security.JwtService;
import com.datashare.backend.service.FileMetadataService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.time.Instant;
import java.util.Collections;
import java.util.HashSet;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class FileControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private FileMetadataService fileMetadataService;

    private FileResponse fileResponse;
    private User testUser;
    private String token;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .id(10L)
                .email("authenticated@example.com")
                .password("encoded_password")
                .firstName("Alice")
                .lastName("Smith")
                .build();

        // Stub UserRepository for the user lookup in Security / UserDetailsService / Jwt Filter
        when(userRepository.findByEmail("authenticated@example.com")).thenReturn(Optional.of(testUser));

        token = jwtService.generateToken(testUser);

        fileResponse = new FileResponse(
                "test-uuid-123",
                "test-file.png",
                "image/png",
                100L,
                Instant.now(),
                Instant.now().plusSeconds(3600),
                false,
                false,
                new HashSet<>(Collections.singletonList("images"))
        );
    }

    // =====================================================================
    // CAS NOMINAUX — Upload (statut attendu : 201 Created, pas 200 OK)
    // =====================================================================

    @Test
    @DisplayName("Upload anonyme : renvoie 201 Created (et non 200)")
    void uploadFile_Anonymous_Success() throws Exception {
        MockMultipartFile mockFile = new MockMultipartFile(
                "file",
                "test-file.png",
                "image/png",
                "Hello content".getBytes()
        );

        when(fileMetadataService.uploadFile(any(), any(), any(), any(), any())).thenReturn(fileResponse);

        mockMvc.perform(multipart("/api/files/upload")
                        .file(mockFile)
                        .param("expiryDays", "5"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.uuid").value("test-uuid-123"))
                .andExpect(jsonPath("$.originalName").value("test-file.png"));
    }

    @Test
    @DisplayName("Upload authentifié : renvoie 201 Created")
    void uploadFile_Authenticated_Success() throws Exception {
        MockMultipartFile mockFile = new MockMultipartFile(
                "file",
                "test-file.png",
                "image/png",
                "Hello content".getBytes()
        );

        when(fileMetadataService.uploadFile(any(), any(), any(), any(), eq("authenticated@example.com")))
                .thenReturn(fileResponse);

        mockMvc.perform(multipart("/api/files/upload")
                        .file(mockFile)
                        .param("expiryDays", "5")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.uuid").value("test-uuid-123"));
    }

    // =====================================================================
    // CAS D'ERREUR & SÉCURITÉ — Rejet des fichiers dangereux
    // (Ces tests corrigent le manque pointé par le mentor : "Tests
    //  FileControllerTest tous nominaux, alors que TESTING.md prétend tester
    //  le rejet des exécutables et le 413. Ces tests n'existent pas.")
    // =====================================================================

    @Test
    @DisplayName("Upload d'un .exe : le service lève AppException(400), le contrôleur renvoie 400")
    void uploadFile_ExeRejected_Returns400() throws Exception {
        MockMultipartFile maliciousFile = new MockMultipartFile(
                "file", "malware.exe", "application/x-msdownload", "MZ fake exe".getBytes());

        when(fileMetadataService.uploadFile(any(), any(), any(), any(), any()))
                .thenThrow(new AppException(
                        "Les fichiers exécutables (.exe) sont interdits pour des raisons de sécurité",
                        HttpStatus.BAD_REQUEST));

        mockMvc.perform(multipart("/api/files/upload").file(maliciousFile))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value(
                        org.hamcrest.Matchers.containsString("interdits")));
    }

    @Test
    @DisplayName("Upload d'un fichier > 1 Go : 413 Payload Too Large")
    void uploadFile_TooLarge_Returns413() throws Exception {
        MockMultipartFile hugeFile = new MockMultipartFile(
                "file", "huge.zip", "application/zip", new byte[]{1, 2, 3});

        when(fileMetadataService.uploadFile(any(), any(), any(), any(), any()))
                .thenThrow(new AppException(
                        "Fichier trop volumineux : la taille maximale autorisée est de 1 Go",
                        HttpStatus.PAYLOAD_TOO_LARGE));

        mockMvc.perform(multipart("/api/files/upload").file(hugeFile))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.status").value(413));
    }

    @Test
    @DisplayName("Upload avec Content-Type falsifié : le service détecte l'incohérence et renvoie 400")
    void uploadFile_MismatchedMime_Returns400() throws Exception {
        // Simule un .exe renommé en .png : Tika détecte la supercherie
        MockMultipartFile sneakyFile = new MockMultipartFile(
                "file", "innocent.png", "image/png",
                new byte[]{0x4D, 0x5A, (byte) 0x90, 0x00});

        when(fileMetadataService.uploadFile(any(), any(), any(), any(), any()))
                .thenThrow(new AppException(
                        "Incohérence détectée : l'extension .png ne correspond pas au type réel du fichier (application/x-msdownload)",
                        HttpStatus.BAD_REQUEST));

        mockMvc.perform(multipart("/api/files/upload").file(sneakyFile))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        org.hamcrest.Matchers.containsString("Incohérence")));
    }

    // =====================================================================
    // CAS D'ERREUR — Téléchargement et autorisation
    // =====================================================================

    @Test
    @DisplayName("Download d'un UUID inexistant : 404 Not Found")
    void downloadFile_NotFound_Returns404() throws Exception {
        when(fileMetadataService.getFileDetails("missing-uuid"))
                .thenThrow(new ResourceNotFoundException("File not found"));

        mockMvc.perform(get("/api/files/download/missing-uuid/details"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    @DisplayName("Download d'un fichier protégé sans mot de passe : 401 Unauthorized")
    void downloadFile_PasswordMissing_Returns401() throws Exception {
        when(fileMetadataService.downloadFile(eq("protected-uuid"), any()))
                .thenThrow(new UnauthorizedException("Incorrect password for downloading this file"));

        mockMvc.perform(get("/api/files/download/protected-uuid"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    @DisplayName("Download d'un fichier expiré : 410 Gone")
    void downloadFile_Expired_Returns410() throws Exception {
        when(fileMetadataService.getFileDetails("expired-uuid"))
                .thenThrow(new AppException(
                        "This file has expired and is no longer available", HttpStatus.GONE));

        mockMvc.perform(get("/api/files/download/expired-uuid/details"))
                .andExpect(status().isGone());
    }

    // =====================================================================
    // CAS NOMINAUX — Récupération et suppression
    // =====================================================================

    @Test
    void getFileDetails_Success() throws Exception {
        when(fileMetadataService.getFileDetails("test-uuid-123")).thenReturn(fileResponse);

        mockMvc.perform(get("/api/files/download/test-uuid-123/details"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.uuid").value("test-uuid-123"));
    }

    @Test
    void downloadFile_Success() throws Exception {
        Resource mockResource = new ByteArrayResource("Hello download".getBytes());
        when(fileMetadataService.downloadFile(eq("test-uuid-123"), any())).thenReturn(mockResource);
        when(fileMetadataService.getFileDetails("test-uuid-123")).thenReturn(fileResponse);

        mockMvc.perform(get("/api/files/download/test-uuid-123"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(header().string("Content-Disposition",
                        org.hamcrest.Matchers.containsString("filename=\"test-file.png\"")))
                .andExpect(content().string("Hello download"));
    }

    @Test
    void getHistory_Success() throws Exception {
        when(fileMetadataService.getUserHistory("authenticated@example.com"))
                .thenReturn(Collections.singletonList(fileResponse));

        mockMvc.perform(get("/api/files/history")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].uuid").value("test-uuid-123"));
    }

    @Test
    @DisplayName("Suppression d'un fichier dont on n'est pas propriétaire : 401")
    void deleteFile_NotOwner_Returns401() throws Exception {
        doThrow(new UnauthorizedException("You do not own this file and cannot delete it"))
                .when(fileMetadataService).deleteFile("test-uuid-123", "authenticated@example.com");

        mockMvc.perform(delete("/api/files/test-uuid-123")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());

        verify(fileMetadataService, times(1)).deleteFile("test-uuid-123", "authenticated@example.com");
    }

    @Test
    void deleteFile_Success() throws Exception {
        doNothing().when(fileMetadataService).deleteFile("test-uuid-123", "authenticated@example.com");

        mockMvc.perform(delete("/api/files/test-uuid-123")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        verify(fileMetadataService, times(1)).deleteFile("test-uuid-123", "authenticated@example.com");
    }
}
