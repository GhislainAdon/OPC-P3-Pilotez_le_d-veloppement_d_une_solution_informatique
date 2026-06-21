package com.datashare.backend.service;

import com.datashare.backend.exception.AppException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests unitaires du service de validation des fichiers téléversés.
 *
 * <p>Ces tests couvrent les exigences de SECURITY.md & TESTING.md :</p>
 * <ul>
 *     <li>Rejet des exécutables (.exe, .bat, .cmd, .sh, .msi, ...)</li>
 *     <li>Rejet des extensions non listées en liste blanche</li>
 *     <li>Détection du type MIME réel par Tika (et non le Content-Type client)</li>
 *     <li>Rejet en cas d'incohérence extension / contenu réel</li>
 *     <li>Rejet des fichiers vides</li>
 *     <li>Rejet des fichiers dépassant 1 Go</li>
 *     <li>Rejet des noms de fichier manquants</li>
 * </ul>
 *
 * <p>Ces tests corrigent le manque identifié par le mentor :</p>
 * <blockquote>
 *     "Tests FileControllerTest tous nominaux, alors que TESTING.md prétend tester
 *     le rejet des exécutables et le 413. Ces tests n'existent pas."
 * </blockquote>
 */
class FileValidationServiceTest {

    private FileValidationService service;

    @BeforeEach
    void setUp() {
        service = new FileValidationService();
    }

    // ---------- Cas nominaux : fichiers autorisés ----------

    @Test
    @DisplayName("Fichier PNG valide : accepté et type MIME détecté")
    void validatePng_returnsImagePng() {
        // PNG magic bytes : 89 50 4E 47 0D 0A 1A 0A
        byte[] pngBytes = new byte[]{
                (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
                0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52
        };
        MockMultipartFile file = new MockMultipartFile(
                "file", "photo.png", "image/png", pngBytes);

        String mimeType = service.validateAndDetectMimeType(file);

        assertEquals("image/png", mimeType);
    }

    @Test
    @DisplayName("Fichier PDF valide : accepté et type MIME détecté")
    void validatePdf_returnsApplicationPdf() {
        // PDF magic bytes : %PDF-1.4
        byte[] pdfBytes = "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n".getBytes();
        MockMultipartFile file = new MockMultipartFile(
                "file", "document.pdf", "application/pdf", pdfBytes);

        String mimeType = service.validateAndDetectMimeType(file);

        assertTrue(mimeType.startsWith("application/pdf"),
                "Le type détecté doit être application/pdf, était : " + mimeType);
    }

    @Test
    @DisplayName("Fichier texte valide : accepté")
    void validateTxt_returnsTextPlain() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "notes.txt", "text/plain", "Hello World".getBytes());

        String mimeType = service.validateAndDetectMimeType(file);

        assertNotNull(mimeType);
        assertTrue(mimeType.startsWith("text/"));
    }

    @Test
    @DisplayName("Fichier ZIP valide : accepté")
    void validateZip_returnsApplicationZip() {
        // ZIP magic bytes : PK\x03\x04
        byte[] zipBytes = new byte[]{
                0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x08, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        };
        MockMultipartFile file = new MockMultipartFile(
                "file", "archive.zip", "application/zip", zipBytes);

        String mimeType = service.validateAndDetectMimeType(file);

        assertNotNull(mimeType);
    }

    // ---------- Cas d'erreur : exécutables interdits ----------

    @Test
    @DisplayName("Fichier .exe : rejeté avec message explicite et statut 400")
    void validateExe_rejectedWithBadRequest() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "malware.exe", "application/x-msdownload", "MZ fake exe".getBytes());

        AppException ex = assertThrows(AppException.class,
                () -> service.validateAndDetectMimeType(file));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().toLowerCase().contains("exécutable")
                || ex.getMessage().toLowerCase().contains("interdit"),
                "Le message doit mentionner l'interdiction : " + ex.getMessage());
    }

    @Test
    @DisplayName("Fichier .bat : rejeté")
    void validateBat_rejected() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "script.bat", "text/plain", "@echo off".getBytes());

        AppException ex = assertThrows(AppException.class,
                () -> service.validateAndDetectMimeType(file));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    @DisplayName("Fichier .sh : rejeté")
    void validateSh_rejected() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "deploy.sh", "text/plain", "#!/bin/bash".getBytes());

        AppException ex = assertThrows(AppException.class,
                () -> service.validateAndDetectMimeType(file));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    @DisplayName("Fichier .msi : rejeté")
    void validateMsi_rejected() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "installer.msi", "application/x-msi", "fake msi".getBytes());

        assertThrows(AppException.class,
                () -> service.validateAndDetectMimeType(file));
    }

    // ---------- Cas d'erreur : extensions non whitelistées ----------

    @Test
    @DisplayName("Fichier .dll : rejeté (extension non autorisée)")
    void validateDll_rejectedAsNotWhitelisted() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "library.dll", "application/x-msdownload", "fake dll".getBytes());

        AppException ex = assertThrows(AppException.class,
                () -> service.validateAndDetectMimeType(file));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    @DisplayName("Fichier .app : rejeté (extension non autorisée)")
    void validateApp_rejectedAsNotWhitelisted() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "macos.app", "application/octet-stream", "fake app".getBytes());

        assertThrows(AppException.class,
                () -> service.validateAndDetectMimeType(file));
    }

    // ---------- Cas d'erreur : falsification Content-Type ----------

    @Test
    @DisplayName("Fichier .exe renommé en .png : rejeté (détection magic bytes MZ + Tika)")
    void validateExeRenamedAsPng_rejectedByContentDetection() {
        // Tika détectera application/x-msdownload ou x-dosexec sur un vrai binaire Windows.
        // En complément, la détection magic bytes analyse les premiers octets (MZ = 4D 5A).
        // Le fichier est rejeté par la PREMIÈRE vérification qui détecte (magic bytes
        // ou incohérence Tika), peu importe laquelle — l'important est le rejet 400.
        byte[] fakeExeBytes = new byte[]{
                0x4D, 0x5A, (byte) 0x90, 0x00, 0x03, 0x00, 0x00, 0x00,
                0x04, 0x00, 0x00, 0x00, (byte) 0xFF, (byte) 0xFF, 0x00, 0x00
        };
        // Le client tente de masquer le .exe en envoyant un Content-Type image/png
        // et un nom de fichier .png — la validation doit détecter la supercherie.
        MockMultipartFile file = new MockMultipartFile(
                "file", "innocent-image.png", "image/png", fakeExeBytes);

        AppException ex = assertThrows(AppException.class,
                () -> service.validateAndDetectMimeType(file));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        // Le message doit mentionner soit l'exécutable détecté (magic bytes),
        // soit l'incohérence extension/MIME (Tika) — les deux mécanismes sont valides.
        String msg = ex.getMessage().toLowerCase();
        assertTrue(msg.contains("exécutable")
                        || msg.contains("executable")
                        || msg.contains("magic bytes")
                        || msg.contains("incohérence")
                        || msg.contains("incoherence"),
                "Le message doit mentionner l'exécutable détecté ou l'incohérence : " + ex.getMessage());
    }

    @Test
    @DisplayName("Fichier .exe renommé en .txt (scénario soutenance) : rejeté par magic bytes MZ")
    void validateExeRenamedAsTxt_rejectedByMagicBytes() {
        // Ce test reproduit EXACTEMENT le scénario de la soutenance :
        // un fichier .exe renommé en .txt est téléversé.
        // AVANT : le fichier passait (faille OWASP).
        // APRÈS : la détection magic bytes MZ bloque le fichier même avec extension .txt.
        byte[] fakeExeBytes = new byte[]{
                0x4D, 0x5A, (byte) 0x90, 0x00, 0x03, 0x00, 0x00, 0x00,
                0x04, 0x00, 0x00, 0x00, (byte) 0xFF, (byte) 0xFF, 0x00, 0x00
        };
        MockMultipartFile file = new MockMultipartFile(
                "file", "QuicSFV.txt", "text/plain", fakeExeBytes);

        AppException ex = assertThrows(AppException.class,
                () -> service.validateAndDetectMimeType(file));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        // Le message doit mentionner la signature magic bytes MZ (4D 5A)
        String msg = ex.getMessage().toLowerCase();
        assertTrue(msg.contains("exécutable") || msg.contains("executable"),
                "Le message doit mentionner la détection d'exécutable : " + ex.getMessage());
    }

    @Test
    @DisplayName("Content-Type client falsifié mais contenu réellement PNG : accepté (Tika valide par contenu)")
    void validatePngWithFakeContentType_acceptedBecauseContentIsPng() {
        // Le client envoie un vrai PNG mais avec un Content-Type bidon (text/plain)
        // Tika détecte image/png, l'extension .png est cohérente : accepté
        byte[] pngBytes = new byte[]{
                (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
                0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52
        };
        MockMultipartFile file = new MockMultipartFile(
                "file", "photo.png", "text/plain", pngBytes);  // Content-Type falsifié

        String mimeType = service.validateAndDetectMimeType(file);
        assertEquals("image/png", mimeType, "Tika doit détecter le vrai type MIME indépendamment du Content-Type client");
    }

    // ---------- Cas d'erreur : fichier vide / manquant ----------

    @Test
    @DisplayName("Fichier vide : rejeté avec 400")
    void validateEmptyFile_rejectedWithBadRequest() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "empty.png", "image/png", new byte[0]);

        AppException ex = assertThrows(AppException.class,
                () -> service.validateAndDetectMimeType(file));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    @DisplayName("MultipartFile null : rejeté avec 400")
    void validateNull_rejected() {
        AppException ex = assertThrows(AppException.class,
                () -> service.validateAndDetectMimeType(null));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    @DisplayName("Nom de fichier manquant : rejeté avec 400")
    void validateMissingFilename_rejected() {
        MockMultipartFile file = new MockMultipartFile(
                "file", null, "image/png", "fake".getBytes());

        AppException ex = assertThrows(AppException.class,
                () -> service.validateAndDetectMimeType(file));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    @DisplayName("Nom de fichier vide : rejeté avec 400")
    void validateBlankFilename_rejected() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "  ", "image/png", "fake".getBytes());

        assertThrows(AppException.class,
                () -> service.validateAndDetectMimeType(file));
    }

    // ---------- Cas d'erreur : taille excessive ----------

    @Test
    @DisplayName("Fichier > 1 Go : rejeté avec 413 Payload Too Large")
    void validateTooLargeFile_rejectedWith413() {
        // On simule un fichier de > 1 Go sans allouer réellement 1 Go de mémoire :
        // on sous-classe MockMultipartFile pour écraser getSize().
        MockMultipartFile file = new MockMultipartFile(
                "file", "huge.zip", "application/zip", "fake".getBytes()) {
            @Override
            public long getSize() {
                return 1024L * 1024L * 1024L + 1; // 1 Go + 1 octet
            }
        };

        AppException ex = assertThrows(AppException.class,
                () -> service.validateAndDetectMimeType(file));
        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, ex.getStatus(),
                "Le statut doit être 413 PAYLOAD_TOO_LARGE");
    }

    // ---------- Cas d'erreur : path traversal ----------

    @Test
    @DisplayName("Nom de fichier avec chemin relatif .. : la validation s'applique sur le basename")
    void validatePathTraversalFilename_handledSafely() {
        // Le service doit extraire l'extension du basename et non du chemin complet
        MockMultipartFile file = new MockMultipartFile(
                "file", "../../../etc/passwd.png", "image/png", "fake".getBytes());

        // Ce test ne doit pas lever d'exception liée au path traversal :
        // soit il est accepté (si le contenu est un vrai PNG), soit rejeté avec 400
        // (si le contenu ne correspond pas à l'extension .png)
        assertDoesNotThrow(() -> {
            try {
                service.validateAndDetectMimeType(file);
            } catch (AppException ex) {
                // Accepté : on attend un 400 (incohérence MIME) car le contenu est "fake"
                assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
            }
        });
    }
}
