package com.datashare.backend.service;

/**
 * Résultat du stockage d'un fichier : chemin physique + type MIME réel détecté.
 */
public record StoredFile(String storagePath, String detectedMimeType) {}
