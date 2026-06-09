package com.datashare.backend.controller;

import com.datashare.backend.dto.FileResponse;
import com.datashare.backend.model.User;
import com.datashare.backend.repository.UserRepository;
import com.datashare.backend.security.JwtService;
import com.datashare.backend.service.FileMetadataService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

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

    @Test
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
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.uuid").value("test-uuid-123"))
                .andExpect(jsonPath("$.originalName").value("test-file.png"));
    }

    @Test
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
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.uuid").value("test-uuid-123"));
    }

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
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"test-file.png\""))
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
    void deleteFile_Success() throws Exception {
        doNothing().when(fileMetadataService).deleteFile("test-uuid-123", "authenticated@example.com");

        mockMvc.perform(delete("/api/files/test-uuid-123")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        verify(fileMetadataService, times(1)).deleteFile("test-uuid-123", "authenticated@example.com");
    }
}
