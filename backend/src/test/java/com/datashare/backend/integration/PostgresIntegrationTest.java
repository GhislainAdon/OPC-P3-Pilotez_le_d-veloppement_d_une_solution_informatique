package com.datashare.backend.integration;

import com.datashare.backend.model.FileMetadata;
import com.datashare.backend.model.User;
import com.datashare.backend.repository.FileMetadataRepository;
import com.datashare.backend.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests d'intégration réels sur PostgreSQL 16 via Testcontainers.
 *
 * <p>Ces tests démarrent un conteneur Docker PostgreSQL éphémère et valident
 * que le code JPA/Hibernate fonctionne sur le vrai moteur de base de données
 * de production, et non sur H2 qui présente des différences de dialecte
 * (gestion des types JSONB, contraintes SQL spécifiques, fonctions natives).</p>
 *
 * <p>Pré-requis : Docker doit être disponible sur la machine d'exécution.
 * Pour activer ces tests, lancer Maven avec : {@code mvn test -Dtest=PostgresIntegrationTest -Ddocker.available=true}
 * (le flag -Ddocker.available=true indique que Docker est accessible). Sans ce flag,
 * les tests sont désactivés (skipped) pour ne pas casser le build sur les environnements
 * sans Docker.</p>
 *
 * <p>Le conteneur est démarré une seule fois pour toute la classe de test
 * (optimisation de temps d'exécution) puis supprimé automatiquement à la fin.</p>
 *
 * <p>Cette classe corrige le manque identifié par le mentor :</p>
 * <blockquote>
 *   "tests d'intégration sur H2 et non PostgreSQL"
 * </blockquote>
 */
@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
@EnabledIfSystemProperty(named = "docker.available", matches = "true")
class PostgresIntegrationTest {

    @Container
    @ServiceConnection
    @SuppressWarnings("resource")
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("datashare_integration_test")
            .withUsername("test")
            .withPassword("test");

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FileMetadataRepository fileMetadataRepository;

    @Test
    @DisplayName("PostgreSQL : un utilisateur peut être persisté et retrouvé par email")
    @Transactional
    void userRepository_canPersistAndFindByEmail() {
        String email = "integration-test-" + UUID.randomUUID() + "@example.com";
        User user = User.builder()
                .email(email)
                .password("$2a$10$encodedPasswordHash")
                .firstName("Integration")
                .lastName("Tester")
                .build();

        User saved = userRepository.save(user);

        assertNotNull(saved.getId(), "L'ID doit être généré par PostgreSQL");
        Optional<User> found = userRepository.findByEmail(email);
        assertTrue(found.isPresent(), "L'utilisateur doit être retrouvé par email");
        assertEquals(email, found.get().getEmail());
        assertEquals("Integration", found.get().getFirstName());
    }

    @Test
    @DisplayName("PostgreSQL : un fichier avec métadonnées peut être persisté")
    @Transactional
    void fileMetadataRepository_canPersistWithAllFields() {
        User user = userRepository.save(User.builder()
                .email("file-owner-" + UUID.randomUUID() + "@example.com")
                .password("$2a$10$encodedPasswordHash")
                .firstName("File")
                .lastName("Owner")
                .build());

        String uuid = UUID.randomUUID().toString();
        Instant now = Instant.now();
        Instant expiry = now.plus(7, ChronoUnit.DAYS);

        FileMetadata metadata = FileMetadata.builder()
                .uuid(uuid)
                .originalName("integration-test.pdf")
                .fileType("application/pdf")
                .fileSize(2048L)
                .storagePath("/app/uploads/" + uuid + "_integration-test.pdf")
                .passwordHash(null)
                .uploadDate(now)
                .expiryDate(expiry)
                .user(user)
                .build();

        FileMetadata saved = fileMetadataRepository.save(metadata);

        assertNotNull(saved.getId());
        Optional<FileMetadata> found = fileMetadataRepository.findByUuid(uuid);
        assertTrue(found.isPresent());
        assertEquals("integration-test.pdf", found.get().getOriginalName());
        assertEquals("application/pdf", found.get().getFileType());
        assertEquals(2048L, found.get().getFileSize());
        assertEquals(user.getId(), found.get().getUser().getId());
    }

    @Test
    @DisplayName("PostgreSQL : la recherche par UUID inexistant renvoie empty")
    void fileMetadataRepository_returnsEmptyForUnknownUuid() {
        Optional<FileMetadata> found = fileMetadataRepository.findByUuid("non-existent-uuid-" + UUID.randomUUID());
        assertTrue(found.isEmpty());
    }

    @Test
    @DisplayName("PostgreSQL : la contrainte d'unicité de l'email est respectée")
    @Transactional
    void userRepository_enforcesUniqueEmail() {
        String email = "duplicate-" + UUID.randomUUID() + "@example.com";
        User first = User.builder()
                .email(email)
                .password("$2a$10$hash1")
                .firstName("First")
                .lastName("User")
                .build();
        userRepository.save(first);

        User second = User.builder()
                .email(email)
                .password("$2a$10$hash2")
                .firstName("Second")
                .lastName("User")
                .build();

        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> userRepository.saveAndFlush(second),
                "PostgreSQL doit rejeter un email en doublon");
    }

    @Test
    @DisplayName("PostgreSQL : isExpired flag fonctionne correctement")
    @Transactional
    void fileMetadataRepository_canQueryByExpiryStatus() {
        User user = userRepository.save(User.builder()
                .email("expiry-test-" + UUID.randomUUID() + "@example.com")
                .password("$2a$10$hash")
                .firstName("Expiry")
                .lastName("Tester")
                .build());

        String activeUuid = UUID.randomUUID().toString();
        fileMetadataRepository.save(FileMetadata.builder()
                .uuid(activeUuid)
                .originalName("active.pdf")
                .fileType("application/pdf")
                .fileSize(100L)
                .storagePath("/app/uploads/" + activeUuid)
                .uploadDate(Instant.now())
                .expiryDate(Instant.now().plus(7, ChronoUnit.DAYS))
                .user(user)
                .build());

        var activeFiles = fileMetadataRepository
                .findByIsExpiredFalseAndExpiryDateBefore(Instant.now().plus(8, ChronoUnit.DAYS));
        assertTrue(activeFiles.isEmpty(),
                "Aucun fichier ne doit être marqué expiré avant la date d'expiration");
    }
}

