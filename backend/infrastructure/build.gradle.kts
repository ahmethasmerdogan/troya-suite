// infrastructure — event store, read model projeksiyonu, Kafka/Redis, dış adapter'lar.
plugins {
    // all-open: Spring anotasyonlu sınıfları open yapar (CGLIB proxy için; @Repository final olamaz).
    kotlin("plugin.spring")
}

dependencies {
    implementation(project(":domain"))
    implementation(project(":application"))

    implementation("org.springframework.boot:spring-boot-starter-jdbc:3.4.1")
    implementation("org.springframework.boot:spring-boot-starter-data-redis:3.4.1")
    implementation("org.flywaydb:flyway-core:11.1.0")
    implementation("org.flywaydb:flyway-database-postgresql:11.1.0")
    runtimeOnly("org.postgresql:postgresql:42.7.4")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin:2.18.2")

    // F6 outbox/interline — Kafka istemcisi (Redpanda dev'de; OutboxRelay yayınlar)
    implementation("org.apache.kafka:kafka-clients:3.8.1")

    testImplementation("org.springframework.boot:spring-boot-starter-test:3.4.1")
    testImplementation("org.testcontainers:postgresql:1.20.4")
    testImplementation("org.testcontainers:junit-jupiter:1.20.4")
}
