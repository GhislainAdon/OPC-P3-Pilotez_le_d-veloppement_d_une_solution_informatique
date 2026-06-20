package com.datashare.backend.service;

import com.datashare.backend.exception.AppException;
import org.apache.tika.Tika;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import java.util.Set;

/**
 * Service central de validation des fichiers téléversés.
 *
 * <p>La validation repose sur trois piliers défensifs (consultez SECURITY.md) :</p>
 * <ol>
 *     <li><b>Taille</b> : la limite Spring multipart (1 Go) est déjà active côté conteneur,
 *         mais on ajoute une vérification défensive ici même pour les fichiers vides.</li>
 *     <li><b>Extension</b> : liste blanche stricte d'extensions autorisées. Toute extension
 *         non listée est rejetée, ce qui bloque par construction les exécutables Windows
 *         (.exe, .bat, .cmd, .msi, .ps1, etc.) et les scripts shell (.sh, .bash).</li>
 *     <li><b>Type MIME réel</b> : détection par <em>Apache Tika</em> sur le contenu binaire
 *         réel du fichier. L'en-tête {@code Content-Type} fourni par le client n'est plus
 *         utilisé, car il est falsifiable (un attaquant peut envoyer un .exe avec un
 *         Content-Type: image/png). Le type détecté par Tika doit cohérent avec l'extension
 *         déclarée.</li>
 * </ol>
 *
 * <p>La validation est appelée systématiquement par {@link FileStorageService#storeFile}
 * avant toute écriture sur le disque, garantissant ainsi qu'aucun fichier rejeté n'est
 * persisté physiquement sur le serveur.</p>
 */
@Service
public class FileValidationService {

    /**
     * Liste blanche des extensions autorisées.
     * Toute extension absente de cet ensemble est rejetée.
     */
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            // Documents
            "pdf", "doc", "docx", "odt", "rtf", "txt", "md", "csv",
            // Tableurs
            "xls", "xlsx", "ods",
            // Présentations
            "ppt", "pptx", "odp",
            // Images
            "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "tiff",
            // Audio / Vidéo
            "mp3", "wav", "ogg", "mp4", "mov", "avi", "mkv", "webm",
            // Archives
            "zip", "tar", "gz", "7z", "rar",
            // Code / Données (sans exécution côté serveur)
            "json", "xml", "yaml", "yml", "html", "css", "java", "py", "js", "ts"
    );

    /**
     * Liste noire explicite des extensions exécutables, à des fins de message clair.
     * Cette liste est défensive : la liste blanche ci-dessus suffit à les rejeter,
     * mais le message d'erreur spécifique aide l'utilisateur légitime à comprendre.
     */
    private static final Set<String> EXECUTABLE_EXTENSIONS = Set.of(
            "exe", "bat", "cmd", "sh", "bash", "msi", "ps1", "vbs", "scr", "com", "jar", "war"
    );

    /**
     * Taille maximale autorisée : 1 Go (défensive, Spring multipart applique déjà 1 Go).
     */
    private static final long MAX_FILE_SIZE_BYTES = 1024L * 1024L * 1024L;

    private final Tika tika = new Tika();

    /**
     * Valide intégralement un fichier téléversé.
     *
     * @param file le fichier multipart à valider
     * @return le type MIME détecté par Tika (à utiliser pour le stockage en base,
     *         en remplacement de {@link MultipartFile#getContentType()} qui est falsifiable)
     * @throws AppException si le fichier est vide, trop gros, a une extension interdite
     *         ou un type MIME détecté non cohérent avec l'extension
     */
    public String validateAndDetectMimeType(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AppException("Aucun fichier reçu ou fichier vide", HttpStatus.BAD_REQUEST);
        }

        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new AppException(
                    "Fichier trop volumineux : la taille maximale autorisée est de 1 Go",
                    HttpStatus.PAYLOAD_TOO_LARGE);
        }

        String originalName = file.getOriginalFilename();
        if (originalName == null || originalName.isBlank()) {
            throw new AppException("Nom de fichier manquant", HttpStatus.BAD_REQUEST);
        }

        String extension = extractExtension(originalName);
        String extensionLower = extension.toLowerCase(Locale.ROOT);

        if (EXECUTABLE_EXTENSIONS.contains(extensionLower)) {
            throw new AppException(
                    "Les fichiers exécutables (." + extensionLower + ") sont interdits pour des raisons de sécurité",
                    HttpStatus.BAD_REQUEST);
        }

        if (!ALLOWED_EXTENSIONS.contains(extensionLower)) {
            throw new AppException(
                    "Extension de fichier non autorisée : ." + extensionLower
                            + ". Consultez la liste blanche dans la documentation.",
                    HttpStatus.BAD_REQUEST);
        }

        // Détection du type MIME réel par analyse du contenu binaire
        String detectedMimeType;
        try (InputStream is = file.getInputStream()) {
            detectedMimeType = tika.detect(is, originalName);
        } catch (IOException e) {
            throw new AppException(
                    "Impossible de lire le contenu du fichier pour validation",
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }

        // Cohérence extension / type détecté
        if (!isMimeConsistentWithExtension(detectedMimeType, extensionLower)) {
            throw new AppException(
                    "Incohérence détectée : l'extension ." + extensionLower
                            + " ne correspond pas au type réel du fichier (" + detectedMimeType + ")",
                    HttpStatus.BAD_REQUEST);
        }

        return detectedMimeType;
    }

    /**
     * Extrait l'extension (sans le point) à partir du nom de fichier original.
     */
    private String extractExtension(String filename) {
        // Nettoyage préalable des éventuels chemins relatifs
        String clean = filename.substring(filename.lastIndexOf('/') + 1);
        clean = clean.substring(clean.lastIndexOf('\\') + 1);

        int dotIndex = clean.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == clean.length() - 1) {
            return "";
        }
        return clean.substring(dotIndex + 1);
    }

    /**
     * Vérifie la cohérence grossière entre l'extension déclarée et le type MIME détecté.
     *
     * <p>Cette vérification empêche les attaques par renommage (un .exe renommé en .png
     * sera détecté comme application/x-msdownload par Tika et donc rejeté).</p>
     */
    private boolean isMimeConsistentWithExtension(String mimeType, String extensionLower) {
        if (mimeType == null) {
            return false;
        }
        String mime = mimeType.toLowerCase(Locale.ROOT);

        // Tika renvoie parfois ce type pour les binaires Windows
        if (mime.contains("x-msdownload") || mime.contains("x-dosexec")
                || mime.contains("application/x-executable") || mime.contains("vnd.microsoft.portable-executable")) {
            return false;
        }

        // Mapping extension -> préfixe MIME attendu
        switch (extensionLower) {
            case "png": return mime.startsWith("image/png");
            case "jpg":
            case "jpeg": return mime.startsWith("image/jpeg") || mime.startsWith("image/jpg");
            case "gif": return mime.startsWith("image/gif");
            case "webp": return mime.startsWith("image/webp") || mime.startsWith("image/vnd");
            case "bmp": return mime.startsWith("image/bmp") || mime.startsWith("image/x-ms-bmp");
            case "svg": return mime.startsWith("image/svg") || mime.startsWith("image/xml-svg") || mime.startsWith("text/xml") || mime.startsWith("application/xml");
            case "tiff": return mime.startsWith("image/tiff");
            case "pdf": return mime.startsWith("application/pdf");
            case "doc": case "docx": return mime.contains("msword") || mime.contains("officedocument.wordprocessing");
            case "xls": case "xlsx": return mime.contains("ms-excel") || mime.contains("officedocument.spreadsheet");
            case "ppt": case "pptx": return mime.contains("ms-powerpoint") || mime.contains("officedocument.presentation");
            case "odt": return mime.contains("opendocument.text");
            case "ods": return mime.contains("opendocument.spreadsheet");
            case "odp": return mime.contains("opendocument.presentation");
            case "rtf": return mime.startsWith("application/rtf") || mime.startsWith("text/rtf");
            case "txt": case "md": case "csv": return mime.startsWith("text/") || mime.startsWith("application/csv");
            case "zip": return mime.startsWith("application/zip") || mime.startsWith("application/x-zip");
            case "tar": case "gz": return mime.startsWith("application/x-tar") || mime.startsWith("application/gzip") || mime.startsWith("application/x-gzip");
            case "7z": return mime.startsWith("application/x-7z");
            case "rar": return mime.startsWith("application/x-rar") || mime.startsWith("application/vnd.rar");
            case "mp3": return mime.startsWith("audio/mpeg") || mime.startsWith("audio/mp3");
            case "wav": return mime.startsWith("audio/wav") || mime.startsWith("audio/x-wav");
            case "ogg": return mime.startsWith("audio/ogg") || mime.startsWith("application/ogg");
            case "mp4": return mime.startsWith("video/mp4") || mime.startsWith("application/mp4");
            case "mov": return mime.startsWith("video/quicktime");
            case "avi": return mime.startsWith("video/x-msvideo") || mime.startsWith("video/avi");
            case "mkv": return mime.startsWith("video/x-matroska");
            case "webm": return mime.startsWith("video/webm") || mime.startsWith("audio/webm");
            case "json": return mime.startsWith("application/json") || mime.startsWith("text/json");
            case "xml": return mime.startsWith("application/xml") || mime.startsWith("text/xml");
            case "yaml": case "yml": return mime.startsWith("application/x-yaml") || mime.startsWith("text/yaml") || mime.startsWith("text/plain");
            case "html": return mime.startsWith("text/html");
            case "css": return mime.startsWith("text/css");
            case "java": case "py": case "js": case "ts": return mime.startsWith("text/plain") || mime.startsWith("text/x-");
            default: return true; // Extension autorisée mais non mappée : on accepte par défaut
        }
    }
}
