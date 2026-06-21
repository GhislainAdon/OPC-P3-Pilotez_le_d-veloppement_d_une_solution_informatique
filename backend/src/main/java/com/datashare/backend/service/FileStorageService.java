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
    private final FileValidationService fileValidationService;

    public FileStorageService(
            @Value("${file.upload-dir}") String uploadDir,
            FileValidationService fileValidationService
    ) {
        this.fileStorageLocation = Paths.get(uploadDir).toAbsolutePath().normalize();
        this.fileValidationService = fileValidationService;
    }

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(this.fileStorageLocation);
        } catch (Exception ex) {
            throw new AppException("Could not create the directory where the uploaded files will be stored.", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Stocke physiquement un fichier après validation stricte (extension + type MIME réel).
     *
     * <p>La validation était auparavant absente côté backend (uniquement présente dans
     * le composant Angular UploadComponent). Un POST direct sur /api/files/upload avec un
     * .exe était accepté et stocké. Ce comportement est désormais corrigé : tout fichier
     * est validé par {@link FileValidationService#validateAndDetectMimeType} avant toute
     * écriture sur disque.</p>
     *
     * @return un {@link StoredFile} contenant le chemin physique de stockage ET le type
     *         MIME détecté par Tika (à persister en base plutôt que le Content-Type client)
     */
    public StoredFile storeFile(MultipartFile file, String uuid) {
        // Validation backend stricte (extension + type MIME réel par contenu)
        String detectedMimeType = fileValidationService.validateAndDetectMimeType(file);

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

            return new StoredFile(targetLocation.toString(), detectedMimeType);
        } catch (IOException ex) {
            throw new AppException("Could not store file " + fileName + ". Please try again!", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public Resource loadFileAsResource(String storagePath) {
        try {
            Path filePath = Paths.get(storagePath).normalize();
            // Défense contre les path traversal : on vérifie que le chemin résolu
            // reste bien sous le répertoire de stockage
            if (!filePath.startsWith(this.fileStorageLocation)) {
                throw new AppException("File path is invalid: " + storagePath, HttpStatus.NOT_FOUND);
            }
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
            if (!filePath.startsWith(this.fileStorageLocation)) {
                // Ne pas logger ni révéler le chemin demandé : tentative potentielle de traversal
                return;
            }
            Files.deleteIfExists(filePath);
        } catch (IOException e) {
            // Log warning but do not crash (can be cleaned manually or through cron)
            System.err.println("Failed to delete physical file: " + storagePath + ". Reason: " + e.getMessage());
        }
    }

    /**
     * Résultat du stockage d'un fichier : chemin physique + type MIME réel détecté.
     */
    public record StoredFile(String storagePath, String detectedMimeType) {}
}
