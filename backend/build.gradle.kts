// Root build — ortak Kotlin/JVM, test, ktlint, detekt yapılandırması (ROADMAP Faz 0).
import io.gitlab.arturbosch.detekt.extensions.DetektExtension
import org.gradle.api.plugins.JavaPluginExtension
import org.gradle.jvm.toolchain.JavaLanguageVersion

plugins {
    // Kotlin 2.0.10 — detekt 1.23.7 bu sürümle derlendi; 2.0.21 ile çalıştırmak desteklenmiyor (uyum).
    kotlin("jvm") version "2.0.10" apply false
    kotlin("plugin.spring") version "2.0.10" apply false
    id("org.springframework.boot") version "3.4.1" apply false
    id("io.spring.dependency-management") version "1.1.7" apply false
    id("org.jlleitschuh.gradle.ktlint") version "12.1.2" apply false
    id("io.gitlab.arturbosch.detekt") version "1.23.7" apply false
}

allprojects {
    group = "com.troya"
    version = "0.1.0"

    repositories {
        mavenCentral()
    }
}

subprojects {
    apply(plugin = "org.jetbrains.kotlin.jvm")
    apply(plugin = "org.jlleitschuh.gradle.ktlint")
    apply(plugin = "io.gitlab.arturbosch.detekt")

    // subprojects {} içinde plugin dinamik uygulandığı için type-safe `java {}` accessor'u yok;
    // extension'ı configure<> ile yapılandır (Gradle Kotlin DSL).
    configure<JavaPluginExtension> {
        toolchain {
            languageVersion.set(JavaLanguageVersion.of(21)) // Java 21 LTS
        }
    }

    // detekt — kök detekt.yml'i varsayılanların üstüne uygula.
    configure<DetektExtension> {
        buildUponDefaultConfig = true
        config.setFrom(rootProject.files("detekt.yml"))
    }

    dependencies {
        "testImplementation"(kotlin("test"))
        "testImplementation"("org.junit.jupiter:junit-jupiter:5.11.4")
        "testImplementation"("io.kotest:kotest-assertions-core:5.9.1")
    }

    tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
        compilerOptions {
            freeCompilerArgs.add("-Xjsr305=strict") // null-safety (Spring nullability)
        }
    }

    tasks.withType<Test> {
        useJUnitPlatform()
    }
}
