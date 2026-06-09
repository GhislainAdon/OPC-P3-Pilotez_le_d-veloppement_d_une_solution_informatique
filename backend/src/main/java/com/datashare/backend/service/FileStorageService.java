package com.datashare.backend.service;

import com.datashare.backend.exception.AppException;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Objects;
import java.util.UUID;

@Service
public class FileStorageService {

    private final Path fileStorageLocation;

    public FileStorageService(@Value("${file.upload-dir}") String uploadDir) {
        this.fileStorageLocation = Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(this.fileStorageLocation);
        } catch (Exception ex) {
            throw new AppException("Could not create the directory where the uploaded files will be stored.", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public String storeFile(MultipartFile file, String uuid) {
        // Clean original filename path
        String fileName = String.format("%s_%s", uuid, Objects.requireNonNull(file.getOriginalFilename()).replaceAll("[^a-zA-Z0-9.-]", "_"));

        try {
            // Check if file name contains invalid characters
            if (fileName.contains("..")) {
                throw new AppException("Sorry! Filename contains invalid path sequence " + fileName, HttpStatus.BAD_REQUEST);
            }

            // Copy file to the target location (Replacing existing file with same name if any)
            Path targetLocation = this.fileStorageLocation.resolve(fileName);
            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);

            return targetLocation.toString();
        } catch (IOException ex) {
            throw new AppException("Could not store file " + fileName + ". Please try again!", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public Resource loadFileAsResource(String storagePath) {
        try {
            Path filePath = Paths.get(storagePath).normalize();
            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists() && resource.isReadable()) {
                return resource;
            } else {
                throw new AppException("File not found or is not readable: " + storagePath, HttpStatus.NOT_FOUND);
            }
        } catch (MalformedURLException ex) {
            throw new AppException("File path is invalid: " + storagePath, HttpStatus.NOT_FOUND);
        }
    }

    public void deletePhysicalFile(String storagePath) {
        try {
            Path filePath = Paths.get(storagePath).normalize();
            Files.deleteIfExists(filePath);
        } catch (IOException e) {
            // Log warning but do not crash (can be cleaned manually or through cron)
            System.err.println("Failed to delete physical file: " + storagePath + ". Reason: " + e.getMessage());
        }
    }
}
