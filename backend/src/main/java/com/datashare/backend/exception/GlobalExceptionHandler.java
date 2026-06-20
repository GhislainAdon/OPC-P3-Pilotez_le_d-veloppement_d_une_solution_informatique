package com.datashare.backend.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.HashMap;
import java.util.Map;

/**
 * Gestionnaire global d'exceptions.
 *
 * <p>Principe de sécurité : ne JAMAIS renvoyer le message brut d'une exception
 * {@code Exception} générique au client, car celui-ci peut contenir des informations
 * sensibles (chemins internes, versions de bibliothèques, structure de la base de
 * données, etc.). Seules les exceptions métier {@link AppException} — dont le message
 * est contrôlé par le code applicatif — sont renvoyées telles quelles. Les autres
 * exceptions sont journalisées côté serveur et remplacées par un message générique.</p>
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(AppException.class)
    public ResponseEntity<Map<String, Object>> handleAppException(AppException ex) {
        Map<String, Object> errorMap = new HashMap<>();
        errorMap.put("status", ex.getStatus().value());
        errorMap.put("error", ex.getStatus().getReasonPhrase());
        errorMap.put("message", ex.getMessage());
        return new ResponseEntity<>(errorMap, ex.getStatus());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach((error) -> {
            String fieldName = ((FieldError) error).getField();
            String errorMessage = error.getDefaultMessage();
            errors.put(fieldName, errorMessage);
        });

        Map<String, Object> errorMap = new HashMap<>();
        errorMap.put("status", HttpStatus.BAD_REQUEST.value());
        errorMap.put("error", "Bad Request");
        errorMap.put("message", "Validation failed");
        errorMap.put("errors", errors);

        return new ResponseEntity<>(errorMap, HttpStatus.BAD_REQUEST);
    }

    /**
     * Rejet Spring multipart lorsque le fichier dépasse la limite configurée
     * (spring.servlet.multipart.max-file-size). On renvoie 413 Payload Too Large
     * avec un message contrôlé plutôt que la stack trace par défaut.
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleMaxUploadSize(MaxUploadSizeExceededException ex) {
        Map<String, Object> errorMap = new HashMap<>();
        errorMap.put("status", HttpStatus.PAYLOAD_TOO_LARGE.value());
        errorMap.put("error", "Payload Too Large");
        errorMap.put("message", "Le fichier dépasse la taille maximale autorisée (1 Go)");
        return new ResponseEntity<>(errorMap, HttpStatus.PAYLOAD_TOO_LARGE);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleResourceNotFound(ResourceNotFoundException ex) {
        Map<String, Object> errorMap = new HashMap<>();
        errorMap.put("status", HttpStatus.NOT_FOUND.value());
        errorMap.put("error", "Not Found");
        errorMap.put("message", ex.getMessage());
        return new ResponseEntity<>(errorMap, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<Map<String, Object>> handleUnauthorized(UnauthorizedException ex) {
        Map<String, Object> errorMap = new HashMap<>();
        errorMap.put("status", HttpStatus.UNAUTHORIZED.value());
        errorMap.put("error", "Unauthorized");
        errorMap.put("message", ex.getMessage());
        return new ResponseEntity<>(errorMap, HttpStatus.UNAUTHORIZED);
    }

    /**
     * Gestionnaire de repli pour toute exception non attrapée plus haut.
     *
     * <p>AUPARAVANT : renvoyait {@code ex.getMessage()} brut au client, ce qui
     * peut fuiter des informations internes (chemins, classes, versions de libs).
     * Le message brut est désormais uniquement journalisé côté serveur, et le
     * client reçoit un message générique "Une erreur inattendue s'est produite".</p>
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGenericException(Exception ex) {
        // Journalisation serveur pour diagnostic (jamais exposée au client)
        System.err.println("[GlobalExceptionHandler] Erreur inattendue : "
                + ex.getClass().getName() + " - " + ex.getMessage());
        ex.printStackTrace();

        Map<String, Object> errorMap = new HashMap<>();
        errorMap.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());
        errorMap.put("error", "Internal Server Error");
        errorMap.put("message", "Une erreur inattendue s'est produite. Veuillez réessayer ultérieurement.");
        return new ResponseEntity<>(errorMap, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
