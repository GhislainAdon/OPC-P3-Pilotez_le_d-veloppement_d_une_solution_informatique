package com.datashare.backend.repository;

import com.datashare.backend.model.FileMetadata;
import com.datashare.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface FileMetadataRepository extends JpaRepository<FileMetadata, Long> {
    Optional<FileMetadata> findByUuid(String uuid);
    List<FileMetadata> findByUserAndIsExpiredFalseOrderByUploadDateDesc(User user);
    List<FileMetadata> findByIsExpiredFalseAndExpiryDateBefore(Instant time);
}
