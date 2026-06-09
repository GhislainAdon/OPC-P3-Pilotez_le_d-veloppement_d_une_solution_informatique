package com.datashare.backend.dto;

import java.time.Instant;
import java.util.Set;

public record FileResponse(
    String uuid,
    String originalName,
    String fileType,
    Long fileSize,
    Instant uploadDate,
    Instant expiryDate,
    Boolean isExpired,
    Boolean isPasswordProtected,
    Set<String> tags
) {}
