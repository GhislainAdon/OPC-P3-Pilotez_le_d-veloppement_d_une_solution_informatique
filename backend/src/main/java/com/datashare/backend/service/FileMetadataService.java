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
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FileMetadataService {

    private final FileMetadataRepository fileMetadataRepository;
    private final TagRepository tagRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public FileResponse uploadFile(
            MultipartFile file,
            Integer expiryDays,
            String password,
            List<String> tagNames,
            String userEmail
    ) {
        // Expiry management (1 to 7 days, default 7)
        int days = (expiryDays == null || expiryDays < 1 || expiryDays > 7) ? 7 : expiryDays;
        Instant uploadTime = Instant.now();
        Instant expiryTime = uploadTime.plus(days, ChronoUnit.DAYS);

        String uuid = UUID.randomUUID().toString();

        // Password protection configuration — validé AVANT le stockage physique
        // (fail-fast : on évite d'écrire un fichier sur disque si la requête est invalide).
        String passwordHash = null;
        if (password != null && !password.isBlank()) {
            if (password.length() < 6) {
                throw new AppException("Password must be at least 6 characters long", HttpStatus.BAD_REQUEST);
            }
            passwordHash = passwordEncoder.encode(password);
        }

        // Store file physically — la validation backend (extension + type MIME réel
        // par Tika) est désormais appliquée dans FileStorageService.storeFile.
        // Le type MIME renvoyé est celui détecté par analyse du contenu, et non plus
        // l'en-tête Content-Type fourni par le client (falsifiable).
        StoredFile storedFile = fileStorageService.storeFile(file, uuid);
        String storagePath = storedFile.storagePath();
        String detectedMimeType = storedFile.detectedMimeType();

        // Fetch User context if logged in
        User user = null;
        if (userEmail != null && !userEmail.isBlank()) {
            user = userRepository.findByEmail(userEmail).orElse(null);
        }

        // Tags configuration
        Set<Tag> tags = new HashSet<>();
        if (tagNames != null) {
            for (String name : tagNames) {
                if (name == null || name.trim().isBlank()) continue;
                String cleanName = name.trim().toLowerCase();
                if (cleanName.length() > 30) {
                    cleanName = cleanName.substring(0, 30);
                }
                String finalCleanName = cleanName;
                Tag tag = tagRepository.findByName(finalCleanName)
                        .orElseGet(() -> tagRepository.save(Tag.builder().name(finalCleanName).build()));
                tags.add(tag);
            }
        }

        // Build File Metadata
        FileMetadata metadata = FileMetadata.builder()
                .uuid(uuid)
                .originalName(file.getOriginalFilename())
                .fileType(detectedMimeType)
                .fileSize(file.getSize())
                .storagePath(storagePath)
                .passwordHash(passwordHash)
                .uploadDate(uploadTime)
                .expiryDate(expiryTime)
                .user(user)
                .tags(tags)
                .build();

        FileMetadata saved = fileMetadataRepository.save(metadata);
        return mapToFileResponse(saved);
    }

    public FileResponse getFileDetails(String uuid) {
        FileMetadata metadata = getValidMetadata(uuid);
        return mapToFileResponse(metadata);
    }

    public Resource downloadFile(String uuid, String password) {
        FileMetadata metadata = getValidMetadata(uuid);

        if (metadata.getPasswordHash() != null) {
            if (password == null || password.isBlank() || !passwordEncoder.matches(password, metadata.getPasswordHash())) {
                throw new UnauthorizedException("Incorrect password for downloading this file");
            }
        }

        return fileStorageService.loadFileAsResource(metadata.getStoragePath());
    }

    public List<FileResponse> getUserHistory(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        return fileMetadataRepository.findByUserAndIsExpiredFalseOrderByUploadDateDesc(user)
                .stream()
                .map(this::mapToFileResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteFile(String uuid, String userEmail) {
        FileMetadata metadata = fileMetadataRepository.findByUuid(uuid)
                .orElseThrow(() -> new ResourceNotFoundException("File not found"));

        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (metadata.getUser() == null || !metadata.getUser().getId().equals(user.getId())) {
            throw new UnauthorizedException("You do not own this file and cannot delete it");
        }

        // Physical deletion
        fileStorageService.deletePhysicalFile(metadata.getStoragePath());

        // Database deletion
        fileMetadataRepository.delete(metadata);
    }

    // Cron job running daily at midnight to delete expired files
    @Scheduled(cron = "0 0 0 * * ?")
    @Transactional
    public void purgeExpiredFiles() {
        Instant now = Instant.now();
        List<FileMetadata> expiredList = fileMetadataRepository.findByIsExpiredFalseAndExpiryDateBefore(now);

        System.out.println("Cron triggered: purging " + expiredList.size() + " expired files.");

        for (FileMetadata file : expiredList) {
            // Delete physical file
            fileStorageService.deletePhysicalFile(file.getStoragePath());
            // Mark as expired in BDD
            file.setIsExpired(true);
            fileMetadataRepository.save(file);
        }
    }

    private FileMetadata getValidMetadata(String uuid) {
        FileMetadata metadata = fileMetadataRepository.findByUuid(uuid)
                .orElseThrow(() -> new ResourceNotFoundException("File not found"));

        if (metadata.getIsExpired() || metadata.getExpiryDate().isBefore(Instant.now())) {
            if (!metadata.getIsExpired()) {
                // Lazily purge physical file if cron didn't run yet
                fileStorageService.deletePhysicalFile(metadata.getStoragePath());
                metadata.setIsExpired(true);
                fileMetadataRepository.save(metadata);
            }
            throw new AppException("This file has expired and is no longer available", HttpStatus.GONE);
        }

        return metadata;
    }

    private FileResponse mapToFileResponse(FileMetadata metadata) {
        return new FileResponse(
                metadata.getUuid(),
                metadata.getOriginalName(),
                metadata.getFileType(),
                metadata.getFileSize(),
                metadata.getUploadDate(),
                metadata.getExpiryDate(),
                metadata.getIsExpired(),
                metadata.getPasswordHash() != null,
                metadata.getTags().stream().map(Tag::getName).collect(Collectors.toSet())
        );
    }
}
